import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ML_API_BASE = 'https://api.mercadolibre.com';
const ML_APP_ID = process.env.ML_APP_ID || process.env.NEXT_PUBLIC_ML_APP_ID || '';
const ML_SECRET_KEY = process.env.ML_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

/**
 * Endpoint de diagnóstico para debugar problemas de autenticação ML.
 * Acesse: POST /api/mercadolivre/debug com { "user_id": "..." }
 */
export async function POST(request: NextRequest) {
  const diagnostico: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env_vars: {},
    db: {},
    ml_api_test: {},
    refresh_test: {},
  };

  try {
    const body = await request.json();
    const { user_id } = body;

    // 1. Verificar variáveis de ambiente
    diagnostico.env_vars = {
      ML_APP_ID: ML_APP_ID ? `✅ presente (${ML_APP_ID.substring(0, 4)}...)` : '❌ AUSENTE',
      ML_SECRET_KEY: ML_SECRET_KEY ? `✅ presente (${ML_SECRET_KEY.length} chars)` : '❌ AUSENTE',
      NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL ? `✅ ${SUPABASE_URL}` : '❌ AUSENTE',
      SUPABASE_SERVICE_ROLE_KEY: SUPABASE_SERVICE_KEY ? `✅ presente (${SUPABASE_SERVICE_KEY.length} chars)` : '❌ AUSENTE',
      NEXT_PUBLIC_APP_URL: APP_URL ? `✅ ${APP_URL}` : '⚠️ AUSENTE (fallback usado)',
    };

    if (!user_id) {
      diagnostico.error = 'user_id não fornecido no body';
      return NextResponse.json(diagnostico, { status: 400 });
    }

    // 2. Verificar banco de dados
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: config, error: dbError } = await supabase
      .from('configuracoes')
      .select('ml_user_id, ml_access_token, ml_refresh_token, ml_token_expires_at, user_id')
      .eq('user_id', user_id)
      .single();

    if (dbError) {
      diagnostico.db = {
        status: '❌ ERRO ao ler configuracoes',
        error: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
      };
      return NextResponse.json(diagnostico);
    }

    if (!config) {
      diagnostico.db = { status: '❌ Nenhuma configuração encontrada para este user_id' };
      return NextResponse.json(diagnostico);
    }

    diagnostico.db = {
      status: '✅ Configuração encontrada',
      user_id: config.user_id,
      ml_user_id: config.ml_user_id || '❌ NULL',
      ml_access_token: config.ml_access_token
        ? `✅ presente (${config.ml_access_token.substring(0, 10)}...${config.ml_access_token.substring(config.ml_access_token.length - 5)})`
        : '❌ NULL',
      ml_refresh_token: config.ml_refresh_token
        ? `✅ presente (${config.ml_refresh_token.substring(0, 10)}...)`
        : '❌ NULL',
      ml_token_expires_at: config.ml_token_expires_at || '❌ NULL',
      token_expires_at_parsed: config.ml_token_expires_at
        ? new Date(config.ml_token_expires_at).toISOString()
        : null,
      token_expired: config.ml_token_expires_at
        ? new Date(config.ml_token_expires_at).getTime() < Date.now()
          ? '⚠️ SIM - token expirado'
          : `✅ NÃO - expira em ${Math.round((new Date(config.ml_token_expires_at).getTime() - Date.now()) / 60000)} minutos`
        : '⚠️ sem data de expiração',
    };

    // 3. Testar access_token contra a API do ML
    if (config.ml_access_token) {
      try {
        const testResponse = await fetch(`${ML_API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${config.ml_access_token}` },
        });

        const testBody = await testResponse.json().catch(() => ({}));

        diagnostico.ml_api_test = {
          endpoint: '/users/me',
          status_code: testResponse.status,
          ok: testResponse.ok,
          response: testResponse.ok
            ? { id: testBody.id, nickname: testBody.nickname }
            : testBody,
          resultado: testResponse.ok
            ? `✅ Token VÁLIDO - usuário: ${testBody.nickname} (${testBody.id})`
            : `❌ Token INVÁLIDO - ${testResponse.status}: ${JSON.stringify(testBody)}`,
        };
      } catch (fetchError: any) {
        diagnostico.ml_api_test = {
          status: '❌ ERRO ao conectar com ML API',
          error: fetchError.message,
        };
      }
    } else {
      diagnostico.ml_api_test = { status: '⏭️ Pulado - sem access_token' };
    }

    // 4. Testar search público (sem auth)
    try {
      const publicSearch = await fetch(
        `${ML_API_BASE}/sites/MLB/search?q=teste&limit=1`
      );
      diagnostico.ml_public_api = {
        endpoint: '/sites/MLB/search?q=teste&limit=1',
        status_code: publicSearch.status,
        ok: publicSearch.ok,
        resultado: publicSearch.ok
          ? '✅ API pública do ML acessível'
          : `❌ API pública falhou: ${publicSearch.status}`,
      };
    } catch (e: any) {
      diagnostico.ml_public_api = {
        status: '❌ ERRO ao acessar ML API pública',
        error: e.message,
      };
    }

    // 5. Se token expirado, testar refresh
    const tokenExpired =
      !config.ml_token_expires_at ||
      new Date(config.ml_token_expires_at).getTime() < Date.now();

    if (tokenExpired && config.ml_refresh_token && ML_SECRET_KEY) {
      try {
        const refreshResp = await fetch(`${ML_API_BASE}/oauth/token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: ML_APP_ID,
            client_secret: ML_SECRET_KEY,
            refresh_token: config.ml_refresh_token,
          }),
        });

        const refreshBody = await refreshResp.json().catch(() => ({}));

        diagnostico.refresh_test = {
          status_code: refreshResp.status,
          ok: refreshResp.ok,
          resultado: refreshResp.ok
            ? `✅ Refresh FUNCIONOU - novo token obtido`
            : `❌ Refresh FALHOU - ${refreshResp.status}: ${JSON.stringify(refreshBody)}`,
          response_keys: refreshResp.ok
            ? Object.keys(refreshBody)
            : undefined,
          error_body: refreshResp.ok ? undefined : refreshBody,
        };

        // Se refresh funcionou, salvar os novos tokens
        if (refreshResp.ok && refreshBody.access_token) {
          const { error: updateError } = await supabase
            .from('configuracoes')
            .update({
              ml_access_token: refreshBody.access_token,
              ml_refresh_token: refreshBody.refresh_token,
              ml_token_expires_at: new Date(
                Date.now() + refreshBody.expires_in * 1000
              ).toISOString(),
            })
            .eq('user_id', user_id);

          diagnostico.refresh_test.saved = updateError
            ? `❌ Erro ao salvar: ${updateError.message}`
            : '✅ Novos tokens salvos no banco';
        }
      } catch (refreshError: any) {
        diagnostico.refresh_test = {
          status: '❌ ERRO ao tentar refresh',
          error: refreshError.message,
        };
      }
    } else if (!tokenExpired) {
      diagnostico.refresh_test = { status: '⏭️ Pulado - token ainda não expirou' };
    } else if (!config.ml_refresh_token) {
      diagnostico.refresh_test = { status: '❌ Sem refresh_token para testar' };
    } else if (!ML_SECRET_KEY) {
      diagnostico.refresh_test = { status: '❌ ML_SECRET_KEY ausente - refresh impossível' };
    }

    return NextResponse.json(diagnostico);
  } catch (err: any) {
    diagnostico.fatal_error = { message: err.message, stack: err.stack };
    return NextResponse.json(diagnostico, { status: 500 });
  }
}
