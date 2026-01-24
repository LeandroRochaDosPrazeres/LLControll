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
