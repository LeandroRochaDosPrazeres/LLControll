import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ML_API_BASE = 'https://api.mercadolibre.com';
const ML_APP_ID = process.env.ML_APP_ID || process.env.NEXT_PUBLIC_ML_APP_ID || '';
const ML_SECRET_KEY = process.env.ML_SECRET_KEY || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

export async function POST(request: NextRequest) {
  const diagnostico: Record<string, any> = {
    timestamp: new Date().toISOString(),
  };

  try {
    const body = await request.json();
    const { user_id } = body;

    // 1. Env vars
    diagnostico.env_vars = {
      ML_APP_ID: ML_APP_ID ? `✅ (${ML_APP_ID.substring(0, 4)}...)` : '❌ AUSENTE',
      ML_SECRET_KEY: ML_SECRET_KEY ? `✅ (${ML_SECRET_KEY.length} chars, starts: ${ML_SECRET_KEY.substring(0, 4)}...)` : '❌ AUSENTE',
      NEXT_PUBLIC_APP_URL: APP_URL || '❌ AUSENTE',
      SUPABASE_URL: SUPABASE_URL ? '✅' : '❌',
      SUPABASE_SERVICE_KEY: SUPABASE_SERVICE_KEY ? `✅ (${SUPABASE_SERVICE_KEY.length} chars)` : '❌',
    };

    // 2. URLs que são usadas no fluxo OAuth
    const callbackUrl = `${APP_URL || 'https://ll-controll.vercel.app'}/api/mercadolivre/callback`;
    diagnostico.oauth_config = {
      redirect_uri_callback_usa: callbackUrl,
      redirect_uri_cliente_usa: `(baseado em window.location.origin no browser)`,
      IMPORTANTE: 'Estas URLs DEVEM ser idênticas à Redirect URI no ML Developer Console',
      ml_developer_console: 'https://developers.mercadolivre.com.br/devcenter',
    };

    // 3. TESTE DIRETO: Credenciais do ML (client_credentials grant)
    diagnostico.ml_credentials_test = {};
    try {
      const credTestResp = await fetch(`${ML_API_BASE}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: ML_APP_ID,
          client_secret: ML_SECRET_KEY,
        }),
      });

      const credTestBody = await credTestResp.json().catch(() => ({}));

      diagnostico.ml_credentials_test = {
        status_code: credTestResp.status,
        ok: credTestResp.ok,
        resultado: credTestResp.ok
          ? '✅ ML_APP_ID e ML_SECRET_KEY são VÁLIDOS'
          : `❌ Credenciais INVÁLIDAS - ${credTestResp.status}`,
        response: credTestResp.ok
          ? { token_type: credTestBody.token_type, scope: credTestBody.scope }
          : credTestBody,
      };
    } catch (e: any) {
      diagnostico.ml_credentials_test = { error: e.message };
    }

    // 4. Testar API pública do ML (sem auth)
    try {
      const pubResp = await fetch(`${ML_API_BASE}/sites/MLB/search?q=teste&limit=1`);
      const pubBody = await pubResp.json().catch(() => ({}));
      diagnostico.ml_public_api = {
        status_code: pubResp.status,
        ok: pubResp.ok,
        resultado: pubResp.ok
          ? `✅ API pública OK (${pubBody.results?.length || 0} resultados)`
          : `❌ ${pubResp.status}: ${JSON.stringify(pubBody).substring(0, 200)}`,
      };
    } catch (e: any) {
      diagnostico.ml_public_api = { error: e.message };
    }

    if (!user_id) {
      diagnostico.error = 'user_id não fornecido';
      return NextResponse.json(diagnostico, { status: 400 });
    }

    // 5. Banco de dados
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: config, error: dbError } = await supabase
      .from('configuracoes')
      .select('ml_user_id, ml_access_token, ml_refresh_token, ml_token_expires_at, user_id')
      .eq('user_id', user_id)
      .single();

    if (dbError) {
      diagnostico.db = {
        status: '❌ ERRO',
        error: dbError.message,
        code: dbError.code,
      };
      return NextResponse.json(diagnostico);
    }

    if (!config) {
      diagnostico.db = { status: '❌ Nenhuma configuração encontrada' };
      return NextResponse.json(diagnostico);
    }

    diagnostico.db = {
      status: '✅ Config encontrada',
      user_id: config.user_id,
      ml_user_id: config.ml_user_id || '❌ NULL',
      ml_access_token: config.ml_access_token
        ? `✅ (${config.ml_access_token.substring(0, 15)}...)`
        : '❌ NULL',
      ml_refresh_token: config.ml_refresh_token
        ? `✅ (${config.ml_refresh_token.substring(0, 15)}...)`
        : '❌ NULL',
      ml_token_expires_at: config.ml_token_expires_at || '❌ NULL',
      token_status: config.ml_token_expires_at
        ? new Date(config.ml_token_expires_at).getTime() > Date.now()
          ? `✅ Válido por ${Math.round((new Date(config.ml_token_expires_at).getTime() - Date.now()) / 60000)} min`
          : '⚠️ EXPIRADO'
        : '⚠️ Sem data',
    };

    // 6. Se tiver access_token, testar na API do ML
    if (config.ml_access_token) {
      try {
        const testResp = await fetch(`${ML_API_BASE}/users/me`, {
          headers: { Authorization: `Bearer ${config.ml_access_token}` },
        });
        const testBody = await testResp.json().catch(() => ({}));
        diagnostico.ml_token_test = {
          status_code: testResp.status,
          resultado: testResp.ok
            ? `✅ Token válido - ${testBody.nickname} (${testBody.id})`
            : `❌ ${testResp.status}: ${JSON.stringify(testBody).substring(0, 200)}`,
        };
      } catch (e: any) {
        diagnostico.ml_token_test = { error: e.message };
      }
    }

    // 7. Se tiver refresh_token e token expirado, testar refresh
    const needsRefresh = !config.ml_token_expires_at ||
      new Date(config.ml_token_expires_at).getTime() < Date.now();

    if (needsRefresh && config.ml_refresh_token) {
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
          resultado: refreshResp.ok
            ? '✅ Refresh funcionou!'
            : `❌ ${refreshResp.status}: ${JSON.stringify(refreshBody).substring(0, 200)}`,
        };

        // Se funcionou, salvar automaticamente
        if (refreshResp.ok && refreshBody.access_token) {
          const { error: saveError } = await supabase
            .from('configuracoes')
            .update({
              ml_access_token: refreshBody.access_token,
              ml_refresh_token: refreshBody.refresh_token,
              ml_token_expires_at: new Date(
                Date.now() + refreshBody.expires_in * 1000
              ).toISOString(),
            })
            .eq('user_id', user_id);

          diagnostico.refresh_test.saved = saveError
            ? `❌ Erro ao salvar: ${saveError.message}`
            : '✅ Tokens salvos!';
        }
      } catch (e: any) {
        diagnostico.refresh_test = { error: e.message };
      }
    } else if (!needsRefresh) {
      diagnostico.refresh_test = { status: '⏭️ Token não expirou' };
    } else {
      diagnostico.refresh_test = { status: '❌ Sem refresh_token' };
    }

    // 8. TESTE de escrita no banco (write test)
    diagnostico.db_write_test = {};
    try {
      const testValue = `debug_test_${Date.now()}`;
      const { error: writeError } = await supabase
        .from('configuracoes')
        .update({ ml_user_id: config.ml_user_id || testValue })
        .eq('user_id', user_id);

      if (writeError) {
        diagnostico.db_write_test = {
          resultado: `❌ Service key NÃO CONSEGUE escrever: ${writeError.message} (code: ${writeError.code})`,
        };
      } else {
        // Verificar se escreveu
        const { data: verify } = await supabase
          .from('configuracoes')
          .select('ml_user_id')
          .eq('user_id', user_id)
          .single();
        diagnostico.db_write_test = {
          resultado: verify ? '✅ Service key consegue LER e ESCREVER no banco' : '❌ Verificação falhou',
        };
      }
    } catch (e: any) {
      diagnostico.db_write_test = { error: e.message };
    }

    // 9. Checklist de ações
    const tokensMissing = !config.ml_access_token;
    diagnostico.checklist = {
      '1_credenciais_ml': diagnostico.ml_credentials_test.ok ? '✅' : '❌ Verifique ML_APP_ID e ML_SECRET_KEY no Vercel',
      '2_tokens_no_banco': tokensMissing ? '❌ Reconecte via Ajustes (tokens ausentes)' : '✅',
      '3_redirect_uri': `Verifique no ML Developer Console que a Redirect URI é: ${callbackUrl}`,
      '4_db_escrita': diagnostico.db_write_test.resultado?.startsWith('✅') ? '✅' : '❌ Problema com service role key',
    };

    return NextResponse.json(diagnostico);
  } catch (err: any) {
    diagnostico.fatal_error = { message: err.message, stack: err.stack?.substring(0, 500) };
    return NextResponse.json(diagnostico, { status: 500 });
  }
}
