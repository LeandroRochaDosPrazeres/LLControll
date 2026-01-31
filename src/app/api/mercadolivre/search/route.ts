import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { refreshToken } from '@/lib/mercadolivre/client';

// Forçar rota dinâmica para evitar erro de build
export const dynamic = 'force-dynamic';

const ML_API_BASE = 'https://api.mercadolibre.com';

interface MLSearchResult {
  id: string;
  title: string;
  price: number;
  sold_quantity: number;
  available_quantity: number;
  thumbnail: string;
  permalink: string;
  condition: string;
  seller: {
    id: number;
    nickname: string;
    power_seller_status?: string;
  };
  shipping: {
    free_shipping: boolean;
  };
}

interface AnaliseResultado {
  query: string;
  totalResultados: number;
  precoMinimo: number;
  precoMaximo: number;
  precoMedio: number;
  precoMediano: number;
  precoSugerido: number;
  fretGratisPercentual: number;
  vendedoresPremium: number;
  itens: MLSearchResult[];
}

// Função para calcular mediana
function calcularMediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const sorted = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Função para calcular preço sugerido competitivo
function calcularPrecoSugerido(precoMedio: number, precoMediano: number, precoMinimo: number): number {
  const sugerido = precoMediano * 0.95; // 5% abaixo da mediana
  const pisoMinimo = precoMinimo * 1.05; // Não menos que 5% acima do mínimo
  return Math.max(sugerido, pisoMinimo);
}

// Função para obter Supabase admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase environment variables not configured');
  }
  return createClient(url, key);
}

// Função para obter access token válido do usuário
async function getValidAccessToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  
  const { data: config } = await supabase
    .from('configuracoes')
    .select('ml_user_id, ml_access_token, ml_refresh_token, ml_token_expires')
    .eq('user_id', userId)
    .single();

  if (!config?.ml_access_token) {
    return null;
  }

  let accessToken = config.ml_access_token;

  // Verificar se token expirou
  if (config.ml_token_expires && new Date(config.ml_token_expires) < new Date()) {
    try {
      const newToken = await refreshToken(config.ml_refresh_token);
      accessToken = newToken.access_token;

      // Atualizar no banco
      await supabase
        .from('configuracoes')
        .update({
          ml_access_token: newToken.access_token,
          ml_refresh_token: newToken.refresh_token,
          ml_token_expires: new Date(Date.now() + newToken.expires_in * 1000).toISOString(),
        })
        .eq('user_id', userId);
    } catch (err) {
      console.error('Erro ao renovar token:', err);
      return null;
    }
  }

  return accessToken;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const userId = searchParams.get('user_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const itemId = searchParams.get('item_id');

    console.log('Search API - userId:', userId, 'query:', query);

    if (!query && !itemId) {
      return NextResponse.json(
        { error: 'Parâmetro "q" ou "item_id" é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se user_id foi fornecido
    if (!userId) {
      return NextResponse.json(
        { error: 'Conecte sua conta do Mercado Livre na aba ML para usar esta funcionalidade' },
        { status: 403 }
      );
    }

    // Obter token de acesso do usuário
    const accessToken = await getValidAccessToken(userId);
    
    console.log('Search API - accessToken found:', !!accessToken);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Conecte sua conta do Mercado Livre na aba ML para usar esta funcionalidade' },
        { status: 403 }
      );
    }

    let searchQuery = query;

    // Se temos um item_id, buscar o título do item para usar como query
    if (itemId && !query) {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };
      
      const itemResponse = await fetch(`${ML_API_BASE}/items/${itemId}`, { headers });
      if (itemResponse.ok) {
        const itemData = await itemResponse.json();
        searchQuery = itemData.title;
      } else {
        return NextResponse.json(
          { error: 'Item não encontrado' },
          { status: 404 }
        );
      }
    }

    // Buscar produtos no Mercado Livre
    const searchUrl = `${ML_API_BASE}/sites/MLB/search?q=${encodeURIComponent(searchQuery!)}&limit=${limit}&sort=relevance`;
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    };
    
    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('ML API Error:', searchResponse.status, errorText);
      
      // Se erro 403, significa que precisa de autenticação
      if (searchResponse.status === 403) {
        return NextResponse.json(
          { error: 'Conecte sua conta do Mercado Livre na aba ML para usar esta funcionalidade' },
          { status: 403 }
        );
      }
      
      throw new Error(`Erro na API do Mercado Livre: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const results: MLSearchResult[] = searchData.results || [];

    if (results.length === 0) {
      return NextResponse.json({
        query: searchQuery,
        totalResultados: 0,
        precoMinimo: 0,
        precoMaximo: 0,
        precoMedio: 0,
        precoMediano: 0,
        precoSugerido: 0,
        fretGratisPercentual: 0,
        vendedoresPremium: 0,
        itens: [],
      });
    }

    // Filtrar itens do próprio vendedor se itemId foi fornecido
    let itensAnalise = results;
    if (itemId && accessToken) {
      const itemHeaders: Record<string, string> = {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      };
      const itemResponse = await fetch(`${ML_API_BASE}/items/${itemId}`, { headers: itemHeaders });
      if (itemResponse.ok) {
        const itemData = await itemResponse.json();
        const mySellerId = itemData.seller_id;
        itensAnalise = results.filter((item) => item.seller.id !== mySellerId);
      }
    }

    // Calcular estatísticas de preço
    const precos = itensAnalise.map((item) => item.price);
    const precoMinimo = Math.min(...precos);
    const precoMaximo = Math.max(...precos);
    const precoMedio = precos.reduce((a, b) => a + b, 0) / precos.length;
    const precoMediano = calcularMediana(precos);
    const precoSugerido = calcularPrecoSugerido(precoMedio, precoMediano, precoMinimo);

    // Calcular % com frete grátis
    const comFreteGratis = itensAnalise.filter((item) => item.shipping?.free_shipping).length;
    const fretGratisPercentual = (comFreteGratis / itensAnalise.length) * 100;

    // Contar vendedores premium/platinum
    const vendedoresPremium = itensAnalise.filter(
      (item) => item.seller?.power_seller_status === 'platinum' || 
                item.seller?.power_seller_status === 'gold'
    ).length;

    const resultado: AnaliseResultado = {
      query: searchQuery!,
      totalResultados: itensAnalise.length,
      precoMinimo,
      precoMaximo,
      precoMedio,
      precoMediano,
      precoSugerido,
      fretGratisPercentual,
      vendedoresPremium,
      itens: itensAnalise.slice(0, 20),
    };

    return NextResponse.json(resultado);
  } catch (error: any) {
    console.error('Erro na busca ML:', error);
    return NextResponse.json(
      { error: error.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
