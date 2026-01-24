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

    // Buscar anúncios do ML
    const idsResponse = await fetch(
      `https://api.mercadolibre.com/users/${config.ml_user_id}/items/search?limit=50`,
      {
        headers: {
          'Authorization': `Bearer ${config.ml_access_token}`,
        },
      }
    );

    if (!idsResponse.ok) {
      return NextResponse.json({ error: 'Erro ao buscar anúncios' }, { status: 500 });
    }

    const idsData = await idsResponse.json();
    const itemIds = idsData.results || [];

    if (itemIds.length === 0) {
      return NextResponse.json({ synced: 0 });
    }

    // Buscar detalhes dos itens
    const itemsResponse = await fetch(
      `https://api.mercadolibre.com/items?ids=${itemIds.join(',')}`,
      {
        headers: {
          'Authorization': `Bearer ${config.ml_access_token}`,
        },
      }
    );

    const itemsData = await itemsResponse.json();
    const items = itemsData.map((item: any) => item.body);

    let synced = 0;

    for (const item of items) {
      if (item.status !== 'active') continue;

      // Verificar se produto já existe
      const { data: existingProduto } = await supabase
        .from('produtos')
        .select('id, quantidade')
        .eq('ml_id', item.id)
        .eq('user_id', user_id)
        .single();

      if (existingProduto) {
        // Atualizar quantidade do produto existente
        if (existingProduto.quantidade !== item.available_quantity) {
          await supabase
            .from('produtos')
            .update({
              quantidade: item.available_quantity,
              valor_venda: item.price,
              nome: item.title,
            })
            .eq('id', existingProduto.id);
          synced++;
        }
      } else {
        // Criar novo produto
        await supabase
          .from('produtos')
          .insert({
            user_id: user_id,
            nome: item.title,
            foto_url: item.thumbnail?.replace('http://', 'https://') || null,
            quantidade: item.available_quantity,
            valor_pago: 0, // Usuário precisa preencher
            valor_venda: item.price,
            ml_id: item.id,
            taxa_tipo: 'classico',
            ativo: true,
          });
        synced++;
      }
    }

    return NextResponse.json({ synced, total: items.length });
  } catch (err: any) {
    console.error('Erro ao sincronizar estoque:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
