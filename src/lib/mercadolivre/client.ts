// Mercado Livre API Client

const ML_API_BASE = 'https://api.mercadolibre.com';

export interface MLToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export interface MLUser {
  id: number;
  nickname: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface MLItem {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  sold_quantity: number;
  thumbnail: string;
  permalink: string;
  status: string;
  category_id: string;
}

export interface MLOrder {
  id: number;
  status: string;
  date_created: string;
  order_items: {
    item: {
      id: string;
      title: string;
    };
    quantity: number;
    unit_price: number;
  }[];
  total_amount: number;
  buyer: {
    id: number;
    nickname: string;
  };
}

// Gerar URL de autorização
export function getAuthUrl(userId?: string): string {
  const clientId = process.env.NEXT_PUBLIC_ML_APP_ID || '5368303012953288';
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ll-controll.vercel.app';
  const redirectUri = `${baseUrl}/api/mercadolivre/callback`;
  
  // Passar userId no state para recuperar no callback
  const state = userId ? encodeURIComponent(userId) : '';
  
  return `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}

// Trocar código por tokens
export async function exchangeCodeForToken(code: string): Promise<MLToken> {
  const response = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.ML_APP_ID!,
      client_secret: process.env.ML_SECRET_KEY!,
      code: code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/mercadolivre/callback`,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Erro ao obter token');
  }

  return response.json();
}

// Renovar token
export async function refreshToken(refresh_token: string): Promise<MLToken> {
  const clientId = process.env.ML_APP_ID || process.env.NEXT_PUBLIC_ML_APP_ID || '5368303012953288';
  const clientSecret = process.env.ML_SECRET_KEY || '';

  const response = await fetch(`${ML_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh_token,
    }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    console.error('[ML Client] Refresh falhou:', response.status, errBody);
    throw new Error(errBody.message || 'Erro ao renovar token');
  }

  return response.json();
}

// Obter dados do usuário
export async function getMLUser(accessToken: string): Promise<MLUser> {
  const response = await fetch(`${ML_API_BASE}/users/me`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao obter usuário');
  }

  return response.json();
}

// Listar anúncios do vendedor
export async function getMLItems(accessToken: string, userId: number): Promise<MLItem[]> {
  // Primeiro, buscar IDs dos itens
  const idsResponse = await fetch(
    `${ML_API_BASE}/users/${userId}/items/search?limit=50`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!idsResponse.ok) {
    throw new Error('Erro ao buscar anúncios');
  }

  const idsData = await idsResponse.json();
  const itemIds = idsData.results || [];

  if (itemIds.length === 0) {
    return [];
  }

  // Buscar detalhes dos itens
  const itemsResponse = await fetch(
    `${ML_API_BASE}/items?ids=${itemIds.join(',')}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!itemsResponse.ok) {
    throw new Error('Erro ao buscar detalhes dos anúncios');
  }

  const itemsData = await itemsResponse.json();
  return itemsData.map((item: any) => item.body);
}

// Buscar pedidos recentes
export async function getMLOrders(
  accessToken: string, 
  sellerId: number,
  status: 'paid' | 'all' = 'paid'
): Promise<MLOrder[]> {
  const url = status === 'all' 
    ? `${ML_API_BASE}/orders/search?seller=${sellerId}&sort=date_desc&limit=50`
    : `${ML_API_BASE}/orders/search?seller=${sellerId}&order.status=paid&sort=date_desc&limit=50`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar pedidos');
  }

  const data = await response.json();
  return data.results || [];
}

// Obter detalhes de um item
export async function getMLItemDetails(accessToken: string, itemId: string): Promise<MLItem> {
  const response = await fetch(`${ML_API_BASE}/items/${itemId}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Erro ao buscar detalhes do item');
  }

  return response.json();
}

// Atualizar quantidade de um item
export async function updateMLItemQuantity(
  accessToken: string, 
  itemId: string, 
  quantity: number
): Promise<void> {
  const response = await fetch(`${ML_API_BASE}/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      available_quantity: quantity,
    }),
  });

  if (!response.ok) {
    throw new Error('Erro ao atualizar quantidade');
  }
}
