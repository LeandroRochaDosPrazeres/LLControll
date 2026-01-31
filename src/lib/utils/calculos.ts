import { TaxaTipo, CalculoLucro } from '@/types/database';

// Configurações padrão das taxas do Mercado Livre
export const TAXAS_PADRAO = {
  classico: 11, // 11%
  premium: 16,  // 16%
  taxaFixaLimite: 79.00, // Valor abaixo do qual aplica taxa fixa
  taxaFixaValor: 6.00,   // Taxa fixa de R$ 6,00
};

interface TaxasConfig {
  taxaClassico?: number;
  taxaPremium?: number;
  taxaFixaLimite?: number;
  taxaFixaValor?: number;
}

/**
 * Calcula a taxa percentual baseada no tipo de anúncio
 */
export function getTaxaPercentual(
  taxaTipo: TaxaTipo,
  config?: TaxasConfig
): number {
  if (taxaTipo === 'premium') {
    return config?.taxaPremium ?? TAXAS_PADRAO.premium;
  }
  return config?.taxaClassico ?? TAXAS_PADRAO.classico;
}

/**
 * Calcula a taxa fixa se o valor de venda for menor que o limite
 */
export function getTaxaFixa(
  valorVenda: number,
  config?: TaxasConfig
): number {
  const limite = config?.taxaFixaLimite ?? TAXAS_PADRAO.taxaFixaLimite;
  const valorFixo = config?.taxaFixaValor ?? TAXAS_PADRAO.taxaFixaValor;
  
  return valorVenda < limite ? valorFixo : 0;
}

/**
 * Calcula o valor total das taxas do Mercado Livre
 */
export function calcularTaxasML(
  valorVenda: number,
  taxaTipo: TaxaTipo,
  config?: TaxasConfig
): { taxaPercentual: number; valorTaxaPercentual: number; taxaFixa: number; totalTaxas: number } {
  const taxaPercentual = getTaxaPercentual(taxaTipo, config);
  const valorTaxaPercentual = (valorVenda * taxaPercentual) / 100;
  const taxaFixa = getTaxaFixa(valorVenda, config);
  const totalTaxas = valorTaxaPercentual + taxaFixa;

  return {
    taxaPercentual,
    valorTaxaPercentual,
    taxaFixa,
    totalTaxas,
  };
}

/**
 * Calcula o lucro líquido por unidade
 * Fórmula: valor_venda - valor_pago - (Taxa ML %) - (Taxa fixa se < R$ 79)
 */
export function calcularLucroUnitario(
  valorVenda: number,
  valorPago: number,
  taxaTipo: TaxaTipo,
  config?: TaxasConfig
): CalculoLucro {
  const { taxaPercentual, totalTaxas, taxaFixa } = calcularTaxasML(
    valorVenda,
    taxaTipo,
    config
  );

  const lucroUnitario = valorVenda - valorPago - totalTaxas;
  const margemPercentual = valorVenda > 0 
    ? (lucroUnitario / valorVenda) * 100 
    : 0;

  return {
    valorVenda,
    valorPago,
    taxaTipo,
    taxaPercentual,
    taxaFixa,
    lucroUnitario,
    margemPercentual,
  };
}

/**
 * Calcula o lucro total de uma venda com múltiplas unidades
 */
export function calcularLucroVenda(
  valorUnitario: number,
  custoUnitario: number,
  quantidade: number,
  taxaTipo: TaxaTipo,
  config?: TaxasConfig
): {
  valorFinal: number;
  custoTotal: number;
  totalTaxas: number;
  lucroLiquido: number;
  taxaPercentual: number;
  taxaFixa: number;
} {
  const valorFinal = valorUnitario * quantidade;
  const custoTotal = custoUnitario * quantidade;
  
  // A taxa fixa é aplicada por pedido, não por unidade
  const { taxaPercentual, valorTaxaPercentual, taxaFixa } = calcularTaxasML(
    valorFinal,
    taxaTipo,
    config
  );
  
  // Taxa fixa é aplicada uma vez por pedido
  const taxaFixaTotal = valorFinal < (config?.taxaFixaLimite ?? TAXAS_PADRAO.taxaFixaLimite) 
    ? taxaFixa 
    : 0;
  
  const totalTaxas = valorTaxaPercentual + taxaFixaTotal;
  const lucroLiquido = valorFinal - custoTotal - totalTaxas;

  return {
    valorFinal,
    custoTotal,
    totalTaxas,
    lucroLiquido,
    taxaPercentual,
    taxaFixa: taxaFixaTotal,
  };
}

/**
 * Formata valor monetário em Real brasileiro
 */
export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

/**
 * Formata percentual
 */
export function formatarPercentual(valor: number, decimais: number = 1): string {
  return `${valor.toFixed(decimais)}%`;
}

/**
 * Retorna a cor baseada no lucro (positivo, negativo, neutro)
 */
export function getCorLucro(lucro: number): string {
  if (lucro > 0) return 'text-success-600';
  if (lucro < 0) return 'text-danger-600';
  return 'text-gray-500';
}

/**
 * Retorna a cor de fundo baseada no lucro
 */
export function getBgCorLucro(lucro: number): string {
  if (lucro > 0) return 'bg-success-50';
  if (lucro < 0) return 'bg-danger-50';
  return 'bg-gray-50';
}

// =====================================================
// FUNÇÕES DE CÁLCULO REVERSO PARA ANÁLISE DE MERCADO
// =====================================================

export interface CalculoReverso {
  precoMercado: number;
  margemDesejada: number;
  taxaTipo: TaxaTipo;
  taxaPercentual: number;
  taxaFixa: number;
  valorMaximoCompra: number;
  lucroEsperado: number;
}

/**
 * Calcula o valor máximo de compra (custo) dado um preço de mercado
 * e uma margem de lucro desejada.
 * 
 * Fórmula reversa:
 * Lucro = PrecoVenda - Custo - Taxas
 * Lucro = PrecoVenda * MargemDesejada
 * 
 * Portanto:
 * Custo = PrecoVenda - Taxas - (PrecoVenda * MargemDesejada)
 * Custo = PrecoVenda * (1 - MargemDesejada) - Taxas
 */
export function calcularValorMaximoCompra(
  precoMercado: number,
  margemDesejadaPercentual: number,
  taxaTipo: TaxaTipo,
  config?: TaxasConfig
): CalculoReverso {
  const { taxaPercentual, totalTaxas, taxaFixa } = calcularTaxasML(
    precoMercado,
    taxaTipo,
    config
  );

  // Converter margem de percentual para decimal (ex: 20% -> 0.20)
  const margemDecimal = margemDesejadaPercentual / 100;
  
  // Lucro esperado = preço de mercado * margem desejada
  const lucroEsperado = precoMercado * margemDecimal;
  
  // Custo máximo = Preço de venda - Taxas - Lucro desejado
  const valorMaximoCompra = precoMercado - totalTaxas - lucroEsperado;

  return {
    precoMercado,
    margemDesejada: margemDesejadaPercentual,
    taxaTipo,
    taxaPercentual,
    taxaFixa,
    valorMaximoCompra: Math.max(0, valorMaximoCompra), // Não pode ser negativo
    lucroEsperado,
  };
}

/**
 * Calcula a margem de lucro mínima viável dado um custo de aquisição
 * e o preço de mercado praticado pela concorrência.
 */
export function calcularMargemPossivel(
  precoMercado: number,
  custoAquisicao: number,
  taxaTipo: TaxaTipo,
  config?: TaxasConfig
): {
  margemPossivel: number;
  lucroUnitario: number;
  viavel: boolean;
} {
  const { totalTaxas } = calcularTaxasML(precoMercado, taxaTipo, config);
  
  const lucroUnitario = precoMercado - custoAquisicao - totalTaxas;
  const margemPossivel = precoMercado > 0 
    ? (lucroUnitario / precoMercado) * 100 
    : 0;

  return {
    margemPossivel,
    lucroUnitario,
    viavel: lucroUnitario > 0,
  };
}

/**
 * Gera uma tabela de cenários de margem para análise
 */
export function gerarCenariosMargem(
  precoMercado: number,
  taxaTipo: TaxaTipo,
  config?: TaxasConfig
): CalculoReverso[] {
  const margens = [10, 15, 20, 25, 30, 35, 40];
  
  return margens.map((margem) => 
    calcularValorMaximoCompra(precoMercado, margem, taxaTipo, config)
  );
}

/**
 * Avalia a competitividade de um preço em relação ao mercado
 */
export function avaliarCompetitividade(
  meuPreco: number,
  precoMedio: number,
  precoMediano: number,
  precoMinimo: number
): {
  status: 'excelente' | 'bom' | 'regular' | 'alto' | 'muito_alto';
  diferencaPercentual: number;
  recomendacao: string;
} {
  const diferencaPercentual = ((meuPreco - precoMediano) / precoMediano) * 100;

  if (meuPreco <= precoMinimo * 1.05) {
    return {
      status: 'excelente',
      diferencaPercentual,
      recomendacao: 'Seu preço está muito competitivo! Você está entre os mais baratos.',
    };
  }
  
  if (meuPreco <= precoMediano * 0.95) {
    return {
      status: 'bom',
      diferencaPercentual,
      recomendacao: 'Seu preço está abaixo da média. Boa competitividade.',
    };
  }
  
  if (meuPreco <= precoMediano * 1.05) {
    return {
      status: 'regular',
      diferencaPercentual,
      recomendacao: 'Seu preço está na média do mercado.',
    };
  }
  
  if (meuPreco <= precoMedio * 1.15) {
    return {
      status: 'alto',
      diferencaPercentual,
      recomendacao: 'Seu preço está acima da média. Considere reduzir para aumentar vendas.',
    };
  }
  
  return {
    status: 'muito_alto',
    diferencaPercentual,
    recomendacao: 'Seu preço está bem acima do mercado. Pode estar perdendo vendas.',
  };
}
