import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { refreshToken } from '@/lib/mercadolivre/client';

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
  const sugerido = precoMediano * 0.95;
  const pisoMinimo = precoMinimo * 1.05;
  return Math.max(sugerido, pisoMinimo);
}

// API POST - mesma estrutura das outras APIs que funcionam
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, query, item_id, limit = 50 } = body;

    console.log('Search API POST - user_id:', user_id, 'query:', query);

    if (!query && !item_id) {
      return NextResponse.json(
        { error: 'Parâmetro "query" ou "item_id" é obrigatório' },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'Conecte sua conta do Mercado Livre na aba ML para usar esta funcionalidade' },
        { status: 403 }
      );
    }

    // Criar cliente Supabase com service role (mesma abordagem da API items que funciona)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar configurações do usuário (mesma query da API items)
    const { data: config, error } = await supabase
      .from('configuracoes')
      .select('ml_user_id, ml_access_token, ml_refresh_token, ml_token_expires')
      .eq('user_id', user_id)
      .single();

    console.log('Config query result - data:', !!config, 'error:', error?.message);
    console.log('ml_access_token presente:', !!config?.ml_access_token);

    if (!config?.ml_access_token) {
      return NextResponse.json(
        { error: 'Conecte sua conta do Mercado Livre na aba ML para usar esta funcionalidade' },
        { status: 401 }
      );
    }

    let accessToken = config.ml_access_token;

    // Verificar se token expirou
    if (config.ml_token_expires && new Date(config.ml_token_expires) < new Date()) {
      console.log('Token expirado, renovando...');
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
          .eq('user_id', user_id);
        
        console.log('Token renovado com sucesso');
      } catch (err) {
        console.error('Erro ao renovar token:', err);
        return NextResponse.json(
          { error: 'Token expirado, reconecte ao ML' },
          { status: 401 }
        );
      }
    }

    let searchQuery = query;

    // Se temos um item_id, buscar o título do item para usar como query
    if (item_id && !query) {
      const itemResponse = await fetch(`${ML_API_BASE}/items/${item_id}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
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
    const searchUrl = `${ML_API_BASE}/sites/MLB/search?q=${encodeURIComponent(searchQuery)}&limit=${limit}&sort=relevance`;
    
    console.log('Buscando no ML:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    console.log('ML Response status:', searchResponse.status);

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('ML API Error:', searchResponse.status, errorText);
      
      if (searchResponse.status === 403) {
        return NextResponse.json(
          { error: 'Erro de autenticação com o Mercado Livre. Tente reconectar sua conta.' },
          { status: 403 }
        );
      }
      
      throw new Error(`Erro na API do Mercado Livre: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const results: MLSearchResult[] = searchData.results || [];

    console.log('Resultados encontrados:', results.length);

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

    // Filtrar itens do próprio vendedor se item_id foi fornecido
    let itensAnalise = results;
    if (item_id) {
      const itemResponse = await fetch(`${ML_API_BASE}/items/${item_id}`, {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });
      
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
      query: searchQuery,
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
  } catch (err: any) {
    console.error('Erro na busca ML:', err);
    return NextResponse.json(
      { error: err.message || 'Erro interno' },
      { status: 500 }
    );
  }
}
