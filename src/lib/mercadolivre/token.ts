/**
 * Helper centralizado para obtenção de access_token válido do Mercado Livre.
 *
 * Fluxo "Silent Refresh":
 *  1. Lê credenciais da tabela `configuracoes`
 *  2. Se faltam < 5 min para expirar (ou já expirou) → refresh
 *  3. Atualiza tokens no banco silenciosamente
 *  4. Retorna access_token válido + ml_user_id
 *
 * Tratamento de erro:
 *  - Se refresh_token falhar → limpa tokens inválidos para forçar re-auth
 *  - Fornece `callMLApi()` que faz retry automático em 401
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const ML_API_BASE = 'https://api.mercadolibre.com';
const ML_APP_ID = process.env.ML_APP_ID || process.env.NEXT_PUBLIC_ML_APP_ID || '5368303012953288';
const ML_SECRET_KEY = process.env.ML_SECRET_KEY || '';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Margem de segurança para refresh preventivo (5 minutos) */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface MLCredentials {
  accessToken: string;
  mlUserId: string;
  supabase: SupabaseClient;
  userId: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export class MLAuthError extends Error {
  public readonly statusCode: number;
  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'MLAuthError';
    this.statusCode = statusCode;
  }
}

// ─── Supabase client reutilizável ──────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
    }
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  return _supabase;
}

// ─── Refresh de token ──────────────────────────────────────────────────────

async function doRefreshToken(refreshTokenValue: string): Promise<TokenResponse> {
  if (!ML_APP_ID || !ML_SECRET_KEY) {
    throw new MLAuthError(
      'ML_APP_ID ou ML_SECRET_KEY não configurados no servidor'
    );
  }

  const response = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ML_APP_ID,
      client_secret: ML_SECRET_KEY,
      refresh_token: refreshTokenValue,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    console.error('[ML Auth] Refresh falhou:', response.status, body);
    throw new MLAuthError(
      body.message || 'Refresh token inválido ou expirado',
      response.status
    );
  }

  return response.json();
}

// ─── Limpeza de tokens inválidos ───────────────────────────────────────────

async function clearInvalidTokens(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  console.warn('[ML Auth] Limpando tokens inválidos para user:', userId);
  await supabase
    .from('configuracoes')
    .update({
      ml_access_token: null,
      ml_refresh_token: null,
      ml_token_expires_at: null,
    })
    .eq('user_id', userId);
}

// ─── getValidToken ─────────────────────────────────────────────────────────

/**
 * Obtém um access_token válido do ML para o usuário.
 *
 * - Lê credenciais do Supabase
 * - Faz silent refresh se necessário (< 5 min do vencimento)
 * - Se refresh falhar, limpa tokens e lança erro para forçar re-auth
 */
export async function getValidToken(userId: string): Promise<MLCredentials> {
  const supabase = getServiceSupabase();

  // 1. Buscar credenciais
  const { data: config, error } = await supabase
    .from('configuracoes')
    .select(
      'ml_user_id, ml_access_token, ml_refresh_token, ml_token_expires_at'
    )
    .eq('user_id', userId)
    .single();

  if (error || !config?.ml_access_token || !config?.ml_user_id) {
    throw new MLAuthError(
      'Conta do Mercado Livre não conectada. Vá em Ajustes para conectar.'
    );
  }

  let accessToken = config.ml_access_token;

  // 2. Verificar se precisa de refresh (expirado OU faltam < 5 min)
  const needsRefresh = (() => {
    // Se não temos data de expiração, NÃO assumir expirado.
    // O token pode ser recém-obtido. Deixar callMLApi lidar com 401.
    if (!config.ml_token_expires_at) {
      console.log('[ML Auth] ml_token_expires_at é null — usando token atual sem refresh');
      return false;
    }
    const expiresAt = new Date(config.ml_token_expires_at).getTime();
    const now = Date.now();
    const remaining = expiresAt - now;
    console.log('[ML Auth] Token expira em', Math.round(remaining / 60000), 'minutos');
    return now >= expiresAt - REFRESH_BUFFER_MS;
  })();

  if (needsRefresh) {
    if (!config.ml_refresh_token) {
      // Sem refresh token → não limpar access_token, talvez ainda funcione
      console.warn('[ML Auth] Refresh necessário mas sem refresh_token — tentando com token atual');
      return {
        accessToken,
        mlUserId: config.ml_user_id,
        supabase,
        userId,
      };
    }

    console.log('[ML Auth] Silent refresh para user:', userId);
    try {
      const newToken = await doRefreshToken(config.ml_refresh_token);
      accessToken = newToken.access_token;

      // Atualizar tokens no banco
      const { error: updateError } = await supabase
        .from('configuracoes')
        .update({
          ml_access_token: newToken.access_token,
          ml_refresh_token: newToken.refresh_token,
          ml_token_expires_at: new Date(
            Date.now() + newToken.expires_in * 1000
          ).toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[ML Auth] Erro ao salvar token renovado:', updateError);
      } else {
        console.log('[ML Auth] Token renovado e salvo com sucesso');
      }
    } catch (err) {
      // Refresh falhou — MAS não limpar tokens!
      // O access_token original ainda pode funcionar.
      // callMLApi tentará novamente se der 401.
      console.warn('[ML Auth] Refresh falhou, mantendo token atual:', err);
    }
  }

  return {
    accessToken,
    mlUserId: config.ml_user_id,
    supabase,
    userId,
  };
}

// ─── callMLApi (fetch com retry em 401) ────────────────────────────────────

/**
 * Faz uma chamada à API do ML com retry automático em caso de 401.
 *
 * Fluxo: request → se 401 → refresh token → retry uma vez → se falhar, lança
 */
export async function callMLApi(
  url: string,
  credentials: MLCredentials,
  options: RequestInit = {}
): Promise<Response> {
  const doFetch = (token: string) =>
    fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

  // Primeira tentativa
  let response = await doFetch(credentials.accessToken);

  // Se 401/403 → tentar refresh + retry
  if (response.status === 401 || response.status === 403) {
    console.warn('[ML API] 401/403 em:', url, '— tentando refresh...');

    const { data: config } = await credentials.supabase
      .from('configuracoes')
      .select('ml_refresh_token')
      .eq('user_id', credentials.userId)
      .single();

    if (!config?.ml_refresh_token) {
      // Sem refresh token → não tem como recuperar
      await clearInvalidTokens(credentials.supabase, credentials.userId);
      throw new MLAuthError('Sessão expirada. Reconecte sua conta do ML.');
    }

    try {
      const newToken = await doRefreshToken(config.ml_refresh_token);
      credentials.accessToken = newToken.access_token;

      const { error: updateError } = await credentials.supabase
        .from('configuracoes')
        .update({
          ml_access_token: newToken.access_token,
          ml_refresh_token: newToken.refresh_token,
          ml_token_expires_at: new Date(
            Date.now() + newToken.expires_in * 1000
          ).toISOString(),
        })
        .eq('user_id', credentials.userId);

      if (updateError) {
        console.error('[ML API] Erro ao salvar token renovado:', updateError);
      }

      // Retry com token novo
      response = await doFetch(newToken.access_token);

      if (response.status === 401 || response.status === 403) {
        // Refresh funcionou mas ML ainda rejeita → tokens realmente inválidos
        await clearInvalidTokens(credentials.supabase, credentials.userId);
        throw new MLAuthError(
          'Token renovado mas ML continua rejeitando. Reconecte sua conta.'
        );
      }
    } catch (err) {
      if (err instanceof MLAuthError) throw err;
      // Refresh falhou → limpar e forçar re-auth
      console.error('[ML API] Refresh falhou no retry:', err);
      await clearInvalidTokens(credentials.supabase, credentials.userId);
      throw new MLAuthError('Falha ao renovar sessão. Reconecte em Ajustes.');
    }
  }

  return response;
}
