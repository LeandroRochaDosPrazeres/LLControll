import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vbhhjukhtrylghclvotv.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Buscar configurações do usuário
    const { data: config } = await supabase
      .from('configuracoes')
      .select('ml_user_id, ml_access_token')
      .eq('user_id', user_id)
      .single();

    if (!config?.ml_access_token) {
      return NextResponse.json({ error: 'ML não conectado' }, { status: 401 });
    }

    // Buscar perguntas
    const response = await fetch(
      `https://api.mercadolibre.com/questions/search?seller_id=${config.ml_user_id}&status=UNANSWERED&sort_fields=date_created&sort_types=DESC`,
      {
        headers: {
          'Authorization': `Bearer ${config.ml_access_token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.message }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({ questions: data.questions || [] });
  } catch (err: any) {
    console.error('Erro ao buscar perguntas:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
