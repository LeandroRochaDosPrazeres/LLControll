import { NextRequest, NextResponse } from 'next/server';
import { getValidToken, callMLApi, MLAuthError } from '@/lib/mercadolivre/token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    // Obter token válido (silent refresh automático)
    const credentials = await getValidToken(user_id);

    // Buscar perguntas não respondidas
    const response = await callMLApi(
      `https://api.mercadolibre.com/questions/search?seller_id=${credentials.mlUserId}&status=UNANSWERED&sort_fields=date_created&sort_types=DESC`,
      credentials
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || 'Erro ao buscar perguntas' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({ questions: data.questions || [] });
  } catch (err: any) {
    console.error('Erro ao buscar perguntas:', err);

    if (err instanceof MLAuthError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
