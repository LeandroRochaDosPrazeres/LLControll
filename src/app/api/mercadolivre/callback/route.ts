import { NextRequest, NextResponse } from 'next/server';
import { getMLUser } from '@/lib/mercadolivre/client';
import { createClient } from '@supabase/supabase-js';

const ML_APP_ID = process.env.ML_APP_ID || '5368303012953288';
const ML_SECRET_KEY = process.env.ML_SECRET_KEY || 'wdSjpo7w61ASY7OztyOO8PM8fFYbAtPb';
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://ll-controll.vercel.app';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vbhhjukhtrylghclvotv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${BASE_URL}/ajustes?ml_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${BASE_URL}/ajustes?ml_error=no_code`
    );
  }

  try {
    // Trocar código por token
    const redirectUri = `${BASE_URL}/api/mercadolivre/callback`;
    
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

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.message || 'Erro ao obter token');
    }

    const tokenData = await tokenResponse.json();
    
    // Obter dados do usuário do ML
    const mlUser = await getMLUser(tokenData.access_token);

    // Salvar no Supabase
    if (SUPABASE_SERVICE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Buscar usuário autenticado
      const { data: configData } = await supabase
        .from('configuracoes')
        .select('user_id')
        .limit(1)
        .single();

      if (configData?.user_id) {
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
    }

    return NextResponse.redirect(
      `${BASE_URL}/ajustes?ml_success=true&nickname=${encodeURIComponent(mlUser.nickname)}`
    );
  } catch (err: any) {
    console.error('Erro no callback ML:', err);
    return NextResponse.redirect(
      `${BASE_URL}/ajustes?ml_error=${encodeURIComponent(err.message || 'unknown')}`
    );
  }
}
