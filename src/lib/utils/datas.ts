import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
  parseISO,
  isToday,
  isYesterday,
  differenceInDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodoFiltro = 'hoje' | 'semana' | 'mes';

/**
 * Retorna o range de datas para o período especificado
 */
export function getDateRange(periodo: PeriodoFiltro): { inicio: Date; fim: Date } {
  const agora = new Date();

  switch (periodo) {
    case 'hoje':
      return {
        inicio: startOfDay(agora),
        fim: endOfDay(agora),
      };
    case 'semana':
      return {
        inicio: startOfWeek(agora, { weekStartsOn: 0 }),
        fim: endOfWeek(agora, { weekStartsOn: 0 }),
      };
    case 'mes':
      return {
        inicio: startOfMonth(agora),
        fim: endOfMonth(agora),
      };
    default:
      return {
        inicio: startOfDay(agora),
        fim: endOfDay(agora),
      };
  }
}

/**
 * Retorna os últimos N dias para gráficos
 */
export function getUltimosDias(dias: number): Date[] {
  const resultado: Date[] = [];
  const hoje = new Date();

  for (let i = dias - 1; i >= 0; i--) {
    resultado.push(subDays(hoje, i));
  }

  return resultado;
}

/**
 * Formata data para exibição amigável
 */
export function formatarData(data: string | Date, formatoCompleto: boolean = false): string {
  const dataObj = typeof data === 'string' ? parseISO(data) : data;

  if (isToday(dataObj)) {
    return 'Hoje';
  }

  if (isYesterday(dataObj)) {
    return 'Ontem';
  }

  if (formatoCompleto) {
    return format(dataObj, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
  }

  const diasAtras = differenceInDays(new Date(), dataObj);
  if (diasAtras < 7) {
    return format(dataObj, 'EEEE', { locale: ptBR });
  }

  return format(dataObj, 'dd/MM/yyyy', { locale: ptBR });
}

/**
 * Formata data para o formato do banco de dados
 */
export function formatarParaBanco(data: Date): string {
  return data.toISOString();
}

/**
 * Formata hora
 */
export function formatarHora(data: string | Date): string {
  const dataObj = typeof data === 'string' ? parseISO(data) : data;
  return format(dataObj, 'HH:mm', { locale: ptBR });
}

/**
 * Formata data e hora juntos
 */
export function formatarDataHora(data: string | Date): string {
  const dataObj = typeof data === 'string' ? parseISO(data) : data;
  return format(dataObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

/**
 * Retorna nome do dia da semana abreviado
 */
export function getDiaSemanaAbreviado(data: Date): string {
  return format(data, 'EEE', { locale: ptBR });
}

/**
 * Retorna nome do mês
 */
export function getNomeMes(data: Date): string {
  return format(data, 'MMMM', { locale: ptBR });
}

/**
 * Gera labels para gráfico semanal
 */
export function gerarLabelsSemanais(): string[] {
  const dias = getUltimosDias(7);
  return dias.map((dia) => getDiaSemanaAbreviado(dia));
}
