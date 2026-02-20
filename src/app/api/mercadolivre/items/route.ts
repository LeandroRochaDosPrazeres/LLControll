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

    // Buscar IDs dos itens com retry automático em 401
    const idsResponse = await callMLApi(
      `${ML_API_BASE}/users/${credentials.mlUserId}/items/search?limit=50`,
      credentials
    );

    if (!idsResponse.ok) {
      const errBody = await idsResponse.json().catch(() => ({}));
      throw new Error(errBody.message || 'Erro ao buscar anúncios');
    }

    const idsData = await idsResponse.json();
    const itemIds: string[] = idsData.results || [];

    if (itemIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Buscar detalhes (multiget não requer auth header na maioria dos casos,
    // mas incluímos por segurança)
    const itemsResponse = await callMLApi(
      `${ML_API_BASE}/items?ids=${itemIds.join(',')}`,
      credentials
    );

    if (!itemsResponse.ok) {
      throw new Error('Erro ao buscar detalhes dos anúncios');
    }

    const itemsData = await itemsResponse.json();
    const items = itemsData.map((item: any) => item.body);

    return NextResponse.json({ items });
  } catch (err: any) {
    console.error('Erro ao buscar anúncios:', err);

    if (err instanceof MLAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
