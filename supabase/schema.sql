-- =====================================================
-- LLControl - Schema SQL para Supabase
-- Versão: 1.0
-- =====================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: produtos
-- Armazena informações dos produtos do inventário
-- =====================================================
CREATE TABLE produtos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  foto_url TEXT,
  quantidade INT DEFAULT 0 CHECK (quantidade >= 0),
  valor_pago DECIMAL(10,2) NOT NULL CHECK (valor_pago >= 0),
  valor_venda DECIMAL(10,2) NOT NULL CHECK (valor_venda >= 0),
  taxa_tipo TEXT DEFAULT 'classico' CHECK (taxa_tipo IN ('classico', 'premium')),
  ml_id TEXT, -- ID do anúncio no Mercado Livre
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_produtos_user_id ON produtos(user_id);
CREATE INDEX idx_produtos_ml_id ON produtos(ml_id);
CREATE INDEX idx_produtos_ativo ON produtos(ativo);

-- =====================================================
-- TABELA: vendas
-- Histórico de vendas para análise D/S/M
-- =====================================================
CREATE TABLE vendas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id) ON DELETE SET NULL,
  produto_nome TEXT NOT NULL, -- Snapshot do nome no momento da venda
  qtd_vendida INT NOT NULL CHECK (qtd_vendida > 0),
  valor_unitario DECIMAL(10,2) NOT NULL,
  valor_final DECIMAL(10,2) NOT NULL,
  custo_unitario DECIMAL(10,2) NOT NULL,
  taxa_tipo TEXT NOT NULL CHECK (taxa_tipo IN ('classico', 'premium')),
  taxa_percentual DECIMAL(5,2) NOT NULL,
  taxa_fixa DECIMAL(10,2) DEFAULT 0,
  lucro_liquido DECIMAL(10,2) NOT NULL,
  ml_order_id TEXT, -- ID do pedido no Mercado Livre
  origem TEXT DEFAULT 'manual' CHECK (origem IN ('manual', 'mercadolivre')),
  data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance nas queries de dashboard
CREATE INDEX idx_vendas_user_id ON vendas(user_id);
CREATE INDEX idx_vendas_data ON vendas(data_venda);
CREATE INDEX idx_vendas_produto_id ON vendas(produto_id);
CREATE INDEX idx_vendas_user_data ON vendas(user_id, data_venda);

-- =====================================================
-- TABELA: configuracoes
-- Configurações do usuário (taxas personalizadas, metas)
-- =====================================================
CREATE TABLE configuracoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  taxa_classico DECIMAL(5,2) DEFAULT 11.00,
  taxa_premium DECIMAL(5,2) DEFAULT 16.00,
  taxa_fixa_limite DECIMAL(10,2) DEFAULT 79.00, -- Valor abaixo do qual aplica taxa fixa
  taxa_fixa_valor DECIMAL(10,2) DEFAULT 6.00,
  meta_diaria DECIMAL(10,2) DEFAULT 0,
  meta_mensal DECIMAL(10,2) DEFAULT 0,
  ml_access_token TEXT,
  ml_refresh_token TEXT,
  ml_user_id TEXT,
  ml_token_expires_at TIMESTAMP WITH TIME ZONE,
  notificacoes_ativas BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_configuracoes_user_id ON configuracoes(user_id);

-- =====================================================
-- FUNÇÕES E TRIGGERS
-- =====================================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para produtos
CREATE TRIGGER trigger_produtos_updated_at
  BEFORE UPDATE ON produtos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para configuracoes
CREATE TRIGGER trigger_configuracoes_updated_at
  BEFORE UPDATE ON configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para decrementar estoque automaticamente após venda
CREATE OR REPLACE FUNCTION decrementar_estoque()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE produtos
  SET quantidade = quantidade - NEW.qtd_vendida
  WHERE id = NEW.produto_id
    AND quantidade >= NEW.qtd_vendida;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estoque insuficiente para o produto';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrementar_estoque
  AFTER INSERT ON vendas
  FOR EACH ROW
  WHEN (NEW.produto_id IS NOT NULL)
  EXECUTE FUNCTION decrementar_estoque();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- Políticas para produtos
CREATE POLICY "Usuários podem ver seus próprios produtos"
  ON produtos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar seus próprios produtos"
  ON produtos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios produtos"
  ON produtos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar seus próprios produtos"
  ON produtos FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para vendas
CREATE POLICY "Usuários podem ver suas próprias vendas"
  ON vendas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias vendas"
  ON vendas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias vendas"
  ON vendas FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas para configuracoes
CREATE POLICY "Usuários podem ver suas próprias configurações"
  ON configuracoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias configurações"
  ON configuracoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias configurações"
  ON configuracoes FOR UPDATE
  USING (auth.uid() = user_id);

-- =====================================================
-- STORAGE BUCKET
-- =====================================================
-- Execute isso no Supabase Dashboard > Storage:
-- 1. Criar bucket "produtos" (público)
-- 2. Adicionar política de upload para usuários autenticados

-- Política de Storage (executar via SQL Editor):
-- INSERT INTO storage.buckets (id, name, public) VALUES ('produtos', 'produtos', true);

-- CREATE POLICY "Usuários autenticados podem fazer upload"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'produtos' AND auth.role() = 'authenticated');

-- CREATE POLICY "Qualquer um pode ver imagens de produtos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'produtos');

-- CREATE POLICY "Usuários podem deletar suas próprias imagens"
--   ON storage.objects FOR DELETE
--   USING (bucket_id = 'produtos' AND auth.uid()::text = (storage.foldername(name))[1]);
