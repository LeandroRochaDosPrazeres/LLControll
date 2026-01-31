import { NextRequest, NextResponse } from 'next/server';

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
  // Sugere um preço ligeiramente abaixo da mediana, mas não muito abaixo do mínimo
  const sugerido = precoMediano * 0.95; // 5% abaixo da mediana
  const pisoMinimo = precoMinimo * 1.05; // Não menos que 5% acima do mínimo
  return Math.max(sugerido, pisoMinimo);
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const itemId = searchParams.get('item_id'); // Para buscar concorrentes de um item específico

    if (!query && !itemId) {
      return NextResponse.json(
        { error: 'Parâmetro "q" ou "item_id" é obrigatório' },
        { status: 400 }
      );
    }

    let searchQuery = query;

    // Se temos um item_id, buscar o título do item para usar como query
    if (itemId && !query) {
      const itemResponse = await fetch(`${ML_API_BASE}/items/${itemId}`);
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

    // Buscar produtos no Mercado Livre (API pública)
    const searchUrl = `${ML_API_BASE}/sites/MLB/search?q=${encodeURIComponent(searchQuery!)}&limit=${limit}&sort=relevance`;
    
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'LLControll/1.0',
      },
      next: { revalidate: 300 }, // Cache por 5 minutos
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('ML API Error:', searchResponse.status, errorText);
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
    if (itemId) {
      // Buscar seller_id do item original para excluir
      const itemResponse = await fetch(`${ML_API_BASE}/items/${itemId}`);
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
      itens: itensAnalise.slice(0, 20), // Retornar apenas os 20 primeiros
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
