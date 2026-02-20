import { NextRequest, NextResponse } from 'next/server';
import { getMLUser } from '@/lib/mercadolivre/client';
import { createClient } from '@supabase/supabase-js';

const ML_APP_ID = process.env.ML_APP_ID || process.env.NEXT_PUBLIC_ML_APP_ID || '5368303012953288';
const ML_SECRET_KEY = process.env.ML_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Detectar a BASE_URL real a partir do request.
 * Prioridade: env var > header origin/host > fallback
 */
function getBaseUrl(request: NextRequest): string {
  // 1. Env var (se configurada)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  }

  // 2. Extrair da URL do request (mais confiável no Vercel)
  const url = request.nextUrl;
  if (url.origin && url.origin !== 'null') {
    return url.origin;
  }

  // 3. Headers
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  if (host) {
    return `${proto}://${host}`;
  }

  // 4. Fallback
  return 'https://ll-controll.vercel.app';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state'); // userId passado pelo state

  const BASE_URL = getBaseUrl(request);

  console.log('[ML Callback] Iniciando. BASE_URL detectada:', BASE_URL);
  console.log('[ML Callback] ENV NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL || 'NÃO DEFINIDA');
  console.log('[ML Callback] Request URL:', request.nextUrl.toString());
  console.log('[ML Callback] Host header:', request.headers.get('host'));
  console.log('[ML Callback] Code presente:', !!code, 'State:', state);
  console.log('[ML Callback] ML_APP_ID:', ML_APP_ID);
  console.log('[ML Callback] ML_SECRET_KEY presente:', !!ML_SECRET_KEY, 'length:', ML_SECRET_KEY.length);

  if (error) {
    console.error('[ML Callback] ML retornou erro:', error);
    return NextResponse.redirect(
      `${BASE_URL}/ajustes?ml_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    console.error('[ML Callback] Sem código de autorização');
    return NextResponse.redirect(
      `${BASE_URL}/ajustes?ml_error=no_code`
    );
  }

  try {
    // A redirect_uri DEVE ser exatamente a mesma que foi usada no getAuthUrl
    const redirectUri = `${BASE_URL}/api/mercadolivre/callback`;
    console.log('[ML Callback] Trocando código por token. redirect_uri:', redirectUri);

    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: ML_APP_ID,
        client_secret: ML_SECRET_KEY,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenBody = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('[ML Callback] Token exchange FALHOU:', tokenResponse.status, JSON.stringify(tokenBody));
      throw new Error(
        `ML token error (${tokenResponse.status}): ${tokenBody.message || tokenBody.error || JSON.stringify(tokenBody)}`
      );
    }

    console.log('[ML Callback] Token obtido com sucesso. expires_in:', tokenBody.expires_in);

    // Obter dados do usuário do ML
    const mlUser = await getMLUser(tokenBody.access_token);
    console.log('[ML Callback] ML User:', mlUser.id, mlUser.nickname);

    // Salvar no Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Usar o userId do state ou buscar o primeiro usuário
    let userId = state ? decodeURIComponent(state) : null;

    if (!userId) {
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('user_id')
        .limit(1)
        .single();
      userId = configData?.user_id;
      console.log('[ML Callback] userId via fallback:', userId);
    }

    if (!userId) {
      throw new Error('Não foi possível determinar o user_id. State ausente e nenhuma configuração encontrada.');
    }

    const tokenPayload = {
      ml_user_id: mlUser.id.toString(),
      ml_access_token: tokenBody.access_token,
      ml_refresh_token: tokenBody.refresh_token,
      ml_token_expires_at: new Date(Date.now() + tokenBody.expires_in * 1000).toISOString(),
    };

    console.log('[ML Callback] Salvando tokens para user:', userId);

    // Verificar se existe configuração
    const { data: existingConfig } = await supabase
      .from('configuracoes')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (existingConfig) {
      const { error: updateError } = await supabase
        .from('configuracoes')
        .update(tokenPayload)
        .eq('user_id', userId);

      if (updateError) {
        console.error('[ML Callback] ERRO no update:', JSON.stringify(updateError));
        throw new Error(`DB update falhou: ${updateError.message} (code: ${updateError.code})`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('configuracoes')
        .insert({ user_id: userId, ...tokenPayload });

      if (insertError) {
        console.error('[ML Callback] ERRO no insert:', JSON.stringify(insertError));
        throw new Error(`DB insert falhou: ${insertError.message} (code: ${insertError.code})`);
      }
    }

    // VERIFICAÇÃO: ler de volta para confirmar que salvou
    const { data: verify } = await supabase
      .from('configuracoes')
      .select('ml_access_token, ml_refresh_token, ml_token_expires_at')
      .eq('user_id', userId)
      .single();

    if (!verify?.ml_access_token) {
      console.error('[ML Callback] VERIFICAÇÃO FALHOU! Tokens não estão no banco após save.');
      console.error('[ML Callback] Verify result:', JSON.stringify(verify));
      throw new Error('Tokens não foram persistidos no banco de dados');
    }

    console.log('[ML Callback] ✅ Tokens salvos e verificados com sucesso!');
    console.log('[ML Callback] expires_at:', verify.ml_token_expires_at);

    return NextResponse.redirect(
      `${BASE_URL}/ajustes?ml_success=true&nickname=${encodeURIComponent(mlUser.nickname)}`
    );
  } catch (err: any) {
    console.error('[ML Callback] ERRO FATAL:', err.message);

    // Em vez de redirect silencioso, retornar página HTML com detalhes do erro
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Erro ML Callback</title></head>
      <body style="font-family: system-ui; max-width: 600px; margin: 40px auto; padding: 20px; background: #fef2f2; border-radius: 12px;">
        <h2 style="color: #dc2626;">❌ Erro ao conectar Mercado Livre</h2>
        <p style="color: #991b1b; font-size: 14px;"><strong>Erro:</strong> ${err.message}</p>
        <hr style="border-color: #fca5a5;">
        <p style="font-size: 12px; color: #666;">
          <strong>BASE_URL detectada:</strong> ${BASE_URL}<br>
          <strong>NEXT_PUBLIC_APP_URL:</strong> ${process.env.NEXT_PUBLIC_APP_URL || 'NÃO DEFINIDA'}<br>
          <strong>ML_APP_ID:</strong> ${ML_APP_ID}<br>
          <strong>ML_SECRET_KEY length:</strong> ${ML_SECRET_KEY.length}<br>
          <strong>SUPABASE_URL:</strong> ${SUPABASE_URL}<br>
          <strong>SERVICE_KEY length:</strong> ${SUPABASE_SERVICE_KEY.length}
        </p>
        <p style="font-size: 12px; color: #999;">Copie esta mensagem e envie ao desenvolvedor.</p>
        <a href="${BASE_URL}/ajustes" style="display: inline-block; margin-top: 16px; padding: 10px 20px; background: #2563eb; color: white; border-radius: 8px; text-decoration: none;">Voltar para Ajustes</a>
      </body>
      </html>
    `;

    return new NextResponse(errorHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
