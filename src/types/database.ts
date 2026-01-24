// Tipos do banco de dados Supabase

export type TaxaTipo = 'classico' | 'premium';
export type OrigemVenda = 'manual' | 'mercadolivre';

export interface Produto {
  id: string;
  user_id: string;
  nome: string;
  descricao?: string;
  foto_url?: string;
  quantidade: number;
  valor_pago: number;
  valor_venda: number;
  taxa_tipo: TaxaTipo;
  ml_id?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProdutoInsert {
  nome: string;
  descricao?: string;
  foto_url?: string;
  quantidade: number;
  valor_pago: number;
  valor_venda: number;
  taxa_tipo?: TaxaTipo;
  ml_id?: string;
}

export interface ProdutoUpdate {
  nome?: string;
  descricao?: string;
  foto_url?: string;
  quantidade?: number;
  valor_pago?: number;
  valor_venda?: number;
  taxa_tipo?: TaxaTipo;
  ml_id?: string;
  ativo?: boolean;
}

export interface Venda {
  id: string;
  user_id: string;
  produto_id?: string;
  produto_nome: string;
  qtd_vendida: number;
  valor_unitario: number;
  valor_final: number;
  custo_unitario: number;
  taxa_tipo: TaxaTipo;
  taxa_percentual: number;
  taxa_fixa: number;
  lucro_liquido: number;
  ml_order_id?: string;
  origem: OrigemVenda;
  data_venda: string;
}

export interface VendaInsert {
  produto_id?: string;
  produto_nome: string;
  qtd_vendida: number;
  valor_unitario: number;
  valor_final: number;
  custo_unitario: number;
  taxa_tipo: TaxaTipo;
  taxa_percentual: number;
  taxa_fixa?: number;
  lucro_liquido: number;
  ml_order_id?: string;
  origem?: OrigemVenda;
}

export interface Configuracoes {
  id: string;
  user_id: string;
  taxa_classico: number;
  taxa_premium: number;
  taxa_fixa_limite: number;
  taxa_fixa_valor: number;
  meta_diaria: number;
  meta_mensal: number;
  ml_access_token?: string;
  ml_refresh_token?: string;
  ml_user_id?: string;
  ml_token_expires_at?: string;
  notificacoes_ativas: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConfiguracoesUpdate {
  taxa_classico?: number;
  taxa_premium?: number;
  taxa_fixa_limite?: number;
  taxa_fixa_valor?: number;
  meta_diaria?: number;
  meta_mensal?: number;
  ml_access_token?: string;
  ml_refresh_token?: string;
  ml_user_id?: string;
  ml_token_expires_at?: string;
  notificacoes_ativas?: boolean;
}

// Tipos para Dashboard
export interface DashboardResumo {
  faturamento: number;
  gastoEstoque: number;
  totalTaxas: number;
  lucroLiquido: number;
  totalVendas: number;
  ticketMedio: number;
}

export interface DashboardSemanal {
  dia: string;
  faturamento: number;
  lucro: number;
  vendas: number;
}

// Tipos para cálculo de lucro
export interface CalculoLucro {
  valorVenda: number;
  valorPago: number;
  taxaTipo: TaxaTipo;
  taxaPercentual: number;
  taxaFixa: number;
  lucroUnitario: number;
  margemPercentual: number;
}

// Database types para Supabase
export interface Database {
  public: {
    Tables: {
      produtos: {
        Row: Produto;
        Insert: ProdutoInsert & { user_id?: string };
        Update: ProdutoUpdate;
      };
      vendas: {
        Row: Venda;
        Insert: VendaInsert & { user_id?: string };
        Update: Partial<VendaInsert>;
      };
      configuracoes: {
        Row: Configuracoes;
        Insert: Partial<Configuracoes> & { user_id: string };
        Update: ConfiguracoesUpdate;
      };
    };
  };
}
