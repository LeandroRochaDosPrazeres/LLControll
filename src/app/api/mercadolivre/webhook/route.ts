import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getMLItemDetails, refreshToken } from '@/lib/mercadolivre/client';

// Webhook para receber notificações do Mercado Livre
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('ML Webhook received:', body);

    // Validar estrutura da notificação
    const { resource, topic, user_id } = body;

    if (!resource || !topic) {
      return NextResponse.json({ error: 'Invalid notification' }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar configuração do usuário pelo ml_user_id
    const { data: config } = await supabase
      .from('configuracoes')
      .select('user_id, ml_access_token, ml_refresh_token, ml_token_expires')
      .eq('ml_user_id', user_id.toString())
      .single();

    if (!config) {
      console.log('Usuário não encontrado para ml_user_id:', user_id);
      return NextResponse.json({ ok: true }); // Retorna OK para não gerar reenvios
    }

    let accessToken = config.ml_access_token;

    // Renovar token se necessário
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
          .eq('user_id', config.user_id);
      } catch (err) {
        console.error('Erro ao renovar token:', err);
        return NextResponse.json({ ok: true });
      }
    }

    // Processar diferentes tipos de notificação
    if (topic === 'orders_v2') {
      // Uma venda foi realizada
      await processOrder(supabase, accessToken, resource, config.user_id);
    } else if (topic === 'items') {
      // Um item foi atualizado
      await processItemUpdate(supabase, accessToken, resource, config.user_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('Erro no webhook ML:', err);
    return NextResponse.json({ ok: true }); // Sempre retorna OK
  }
}

async function processOrder(
  supabase: any, 
  accessToken: string, 
  resource: string,
  userId: string
) {
  try {
    // Buscar detalhes do pedido
    const response = await fetch(`https://api.mercadolibre.com${resource}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) return;

    const order = await response.json();

    // Verificar se já processamos este pedido
    const { data: existingVenda } = await supabase
      .from('vendas')
      .select('id')
      .eq('ml_order_id', order.id.toString())
      .single();

    if (existingVenda) {
      console.log('Pedido já processado:', order.id);
      return;
    }

    // Processar cada item do pedido
    for (const orderItem of order.order_items) {
      const mlItemId = orderItem.item.id;
      const qtdVendida = orderItem.quantity;
      const valorFinal = orderItem.unit_price * qtdVendida;

      // Buscar produto vinculado no estoque
      const { data: produto } = await supabase
        .from('produtos')
        .select('*')
        .eq('ml_id', mlItemId)
        .eq('user_id', userId)
        .single();

      if (produto) {
        // Calcular lucro (usando taxas do Mercado Livre)
        const custoTotal = Number(produto.valor_pago) * qtdVendida;
        const taxaPercentual = produto.taxa_tipo === 'premium' ? 16 : 11;
        const taxaFixa = 6;
        const taxas = (valorFinal * taxaPercentual / 100) + taxaFixa;
        const lucroLiquido = valorFinal - custoTotal - taxas;

        // Registrar venda
        await supabase.from('vendas').insert({
          user_id: userId,
          produto_id: produto.id,
          produto_nome: produto.nome,
          qtd_vendida: qtdVendida,
          valor_final: valorFinal,
          custo_unitario: produto.valor_pago,
          taxa_percentual: taxaPercentual,
          taxa_fixa: taxaFixa,
          lucro_liquido: lucroLiquido,
          ml_order_id: order.id.toString(),
          data_venda: new Date(order.date_created).toISOString(),
        });

        // Atualizar estoque
        const novaQtd = Math.max(0, produto.quantidade - qtdVendida);
        await supabase
          .from('produtos')
          .update({ quantidade: novaQtd })
          .eq('id', produto.id);

        console.log(`Venda processada: ${produto.nome} x${qtdVendida}, Lucro: ${lucroLiquido}`);
      }
    }
  } catch (err) {
    console.error('Erro ao processar pedido:', err);
  }
}

async function processItemUpdate(
  supabase: any,
  accessToken: string,
  resource: string,
  userId: string
) {
  try {
    // Extrair ID do item do resource (/items/MLB123456)
    const itemId = resource.split('/').pop();
    
    if (!itemId) return;

    // Buscar detalhes do item
    const item = await getMLItemDetails(accessToken, itemId);

    // Atualizar produto vinculado
    const { data: produto } = await supabase
      .from('produtos')
      .select('id')
      .eq('ml_id', itemId)
      .eq('user_id', userId)
      .single();

    if (produto) {
      await supabase
        .from('produtos')
        .update({
          nome: item.title,
          valor_venda: item.price,
        })
        .eq('id', produto.id);

      console.log(`Produto atualizado do ML: ${item.title}`);
    }
  } catch (err) {
    console.error('Erro ao processar atualização de item:', err);
  }
}
