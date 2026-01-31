import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Função para criar o cliente Supabase (lazy initialization)
function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  
  return createClient(url, key);
}

// Tipos para notificações do Mercado Livre
interface MLNotification {
  resource: string;
  user_id: string;
  topic: string;
  application_id: number;
  attempts: number;
  sent: string;
  received: string;
}

interface MLOrder {
  id: number;
  status: string;
  status_detail: string | null;
  date_created: string;
  date_closed: string;
  order_items: MLOrderItem[];
  total_amount: number;
  currency_id: string;
  buyer: {
    id: number;
    nickname: string;
  };
  payments: MLPayment[];
}

interface MLOrderItem {
  item: {
    id: string;
    title: string;
    variation_id: number | null;
  };
  quantity: number;
  unit_price: number;
  full_unit_price: number;
  currency_id: string;
}

interface MLPayment {
  id: number;
  status: string;
  status_detail: string;
  payment_type: string;
  total_paid_amount: number;
}

/**
 * Busca detalhes de um pedido no Mercado Livre
 */
async function fetchOrderDetails(
  orderId: string,
  accessToken: string
): Promise<MLOrder | null> {
  try {
    const response = await fetch(
      `https://api.mercadolibre.com/orders/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Erro ao buscar pedido ML:', response.status);
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Erro ao buscar pedido ML:', error);
    return null;
  }
}

/**
 * Processa uma ordem aprovada do Mercado Livre
 */
async function processOrder(order: MLOrder, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  
  for (const item of order.order_items) {
    const mlItemId = item.item.id;

    // Buscar produto pelo ml_id
    const { data: produto, error: produtoError } = await supabaseAdmin
      .from('produtos')
      .select('*')
      .eq('ml_id', mlItemId)
      .eq('user_id', userId)
      .single();

    if (produtoError || !produto) {
      console.log(`Produto não encontrado para ML ID: ${mlItemId}`);
      continue;
    }

    // Buscar configurações do usuário para taxas
    const { data: config } = await supabaseAdmin
      .from('configuracoes')
      .select('*')
      .eq('user_id', userId)
      .single();

    const taxaPercentual = produto.taxa_tipo === 'premium' 
      ? (config?.taxa_premium || 16)
      : (config?.taxa_classico || 11);

    const valorFinal = item.unit_price * item.quantity;
    const valorTaxaPercentual = (valorFinal * taxaPercentual) / 100;
    const taxaFixa = valorFinal < (config?.taxa_fixa_limite || 79) 
      ? (config?.taxa_fixa_valor || 6) 
      : 0;
    const custoTotal = produto.valor_pago * item.quantity;
    const lucroLiquido = valorFinal - custoTotal - valorTaxaPercentual - taxaFixa;

    // Verificar se a venda já foi registrada
    const { data: vendaExistente } = await supabaseAdmin
      .from('vendas')
      .select('id')
      .eq('ml_order_id', order.id.toString())
      .eq('produto_id', produto.id)
      .single();

    if (vendaExistente) {
      console.log(`Venda já registrada para order ${order.id}, item ${mlItemId}`);
      continue;
    }

    // Registrar a venda
    const { error: vendaError } = await supabaseAdmin
      .from('vendas')
      .insert({
        user_id: userId,
        produto_id: produto.id,
        produto_nome: produto.nome,
        qtd_vendida: item.quantity,
        valor_unitario: item.unit_price,
        valor_final: valorFinal,
        custo_unitario: produto.valor_pago,
        taxa_tipo: produto.taxa_tipo,
        taxa_percentual: taxaPercentual,
        taxa_fixa: taxaFixa,
        lucro_liquido: lucroLiquido,
        ml_order_id: order.id.toString(),
        origem: 'mercadolivre',
        data_venda: order.date_created,
      });

    if (vendaError) {
      console.error('Erro ao registrar venda:', vendaError);
      continue;
    }

    console.log(`Venda registrada: ${produto.nome} x${item.quantity} - Lucro: ${lucroLiquido}`);

    // TODO: Enviar notificação push para o usuário
    // Implementar com web push ou serviço de notificação
  }
}

/**
 * Webhook handler para notificações do Mercado Livre
 * Endpoint: POST /api/ml-webhook
 */
export async function POST(request: NextRequest) {
  try {
    const notification: MLNotification = await request.json();
    
    console.log('Webhook ML recebido:', notification);

    // Verificar se é uma notificação de pedido
    if (notification.topic !== 'orders_v2' && notification.topic !== 'orders') {
      return NextResponse.json({ 
        received: true, 
        processed: false, 
        reason: 'Not an order notification' 
      });
    }

    // Extrair o ID do pedido do resource
    // Formato: /orders/ORDER_ID
    const resourceMatch = notification.resource.match(/\/orders\/(\d+)/);
    if (!resourceMatch) {
      return NextResponse.json({ 
        received: true, 
        processed: false, 
        reason: 'Invalid resource format' 
      });
    }

    const orderId = resourceMatch[1];
    const mlUserId = notification.user_id;
    
    const supabaseAdmin = getSupabaseAdmin();

    // Buscar configurações do usuário pelo ml_user_id
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes')
      .select('*')
      .eq('ml_user_id', mlUserId)
      .single();

    if (configError || !config || !config.ml_access_token) {
      console.error('Configuração não encontrada para ML user:', mlUserId);
      return NextResponse.json({ 
        received: true, 
        processed: false, 
        reason: 'User configuration not found' 
      });
    }

    // TODO: Implementar refresh token se expirado
    // Verificar config.ml_token_expires_at

    // Buscar detalhes do pedido
    const order = await fetchOrderDetails(orderId, config.ml_access_token);

    if (!order) {
      return NextResponse.json({ 
        received: true, 
        processed: false, 
        reason: 'Could not fetch order details' 
      });
    }

    // Processar apenas pedidos pagos/aprovados
    if (order.status !== 'paid') {
      console.log(`Pedido ${orderId} não está pago. Status: ${order.status}`);
      return NextResponse.json({ 
        received: true, 
        processed: false, 
        reason: `Order status: ${order.status}` 
      });
    }

    // Processar a ordem
    await processOrder(order, config.user_id);

    return NextResponse.json({ 
      received: true, 
      processed: true,
      orderId: orderId
    });

  } catch (error) {
    console.error('Erro no webhook ML:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler para validação do webhook pelo Mercado Livre
 */
export async function GET(request: NextRequest) {
  // O ML faz um GET para validar o endpoint
  return NextResponse.json({ status: 'ok' });
}
