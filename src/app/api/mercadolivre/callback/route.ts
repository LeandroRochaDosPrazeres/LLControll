import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, getMLUser } from '@/lib/mercadolivre/client';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // URL base para redirecionamento
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/ajustes?ml_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/ajustes?ml_error=no_code`
    );
  }

  try {
    // Trocar código por token
    const tokenData = await exchangeCodeForToken(code);
    
    // Obter dados do usuário do ML
    const mlUser = await getMLUser(tokenData.access_token);

    // Salvar no Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar usuário autenticado pelo cookie (simplificado)
    // Em produção, você deve usar o token do usuário
    const { data: configData } = await supabase
      .from('configuracoes')
      .select('user_id')
      .limit(1)
      .single();

    if (configData?.user_id) {
      // Atualizar configurações com dados do ML
      await supabase
        .from('configuracoes')
        .update({
          ml_user_id: mlUser.id.toString(),
          ml_access_token: tokenData.access_token,
          ml_refresh_token: tokenData.refresh_token,
          ml_token_expires: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
          ml_nickname: mlUser.nickname,
        })
        .eq('user_id', configData.user_id);
    }

    return NextResponse.redirect(
      `${baseUrl}/ajustes?ml_success=true&nickname=${encodeURIComponent(mlUser.nickname)}`
    );
  } catch (err: any) {
    console.error('Erro no callback ML:', err);
    return NextResponse.redirect(
      `${baseUrl}/ajustes?ml_error=${encodeURIComponent(err.message || 'unknown')}`
    );
  }
}
