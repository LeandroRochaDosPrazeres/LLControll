import { NextRequest, NextResponse } from 'next/server';
import { getMLOrders, refreshToken } from '@/lib/mercadolivre/client';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar configurações do usuário
    const { data: config } = await supabase
      .from('configuracoes')
      .select('ml_user_id, ml_access_token, ml_refresh_token, ml_token_expires')
      .eq('user_id', user_id)
      .single();

    if (!config?.ml_access_token) {
      return NextResponse.json({ error: 'ML não conectado' }, { status: 401 });
    }

    let accessToken = config.ml_access_token;

    // Verificar se token expirou
    if (config.ml_token_expires && new Date(config.ml_token_expires) < new Date()) {
      try {
        const newToken = await refreshToken(config.ml_refresh_token);
        accessToken = newToken.access_token;

        await supabase
          .from('configuracoes')
          .update({
            ml_access_token: newToken.access_token,
            ml_refresh_token: newToken.refresh_token,
            ml_token_expires: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
          })
          .eq('user_id', user_id);
      } catch (err) {
        return NextResponse.json({ error: 'Token expirado, reconecte ao ML' }, { status: 401 });
      }
    }

    // Buscar pedidos do ML
    const orders = await getMLOrders(accessToken, parseInt(config.ml_user_id), 'paid');

    return NextResponse.json({ orders });
  } catch (err: any) {
    console.error('Erro ao buscar pedidos:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
