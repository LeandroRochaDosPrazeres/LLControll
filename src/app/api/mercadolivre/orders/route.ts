import { NextRequest, NextResponse } from 'next/server';
import { getValidToken, callMLApi, MLAuthError } from '@/lib/mercadolivre/token';

const ML_API_BASE = 'https://api.mercadolibre.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Obter token válido (silent refresh automático)
    const credentials = await getValidToken(user_id);

    // Buscar pedidos com retry automático em 401
    const url = `${ML_API_BASE}/orders/search?seller=${credentials.mlUserId}&order.status=paid&sort=date_desc&limit=50`;
    const response = await callMLApi(url, credentials);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.message || 'Erro ao buscar pedidos');
    }

    const data = await response.json();
    return NextResponse.json({ orders: data.results || [] });
  } catch (err: any) {
    console.error('Erro ao buscar pedidos:', err);

    if (err instanceof MLAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
