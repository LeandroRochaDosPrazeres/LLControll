import { NextRequest, NextResponse } from 'next/server';
import { getMLItems } from '@/lib/mercadolivre/client';
import { getValidToken, MLAuthError } from '@/lib/mercadolivre/token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Obter token válido (silent refresh automático)
    const credentials = await getValidToken(user_id);

    // Buscar anúncios do ML
    const items = await getMLItems(
      credentials.accessToken,
      parseInt(credentials.mlUserId)
    );

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
