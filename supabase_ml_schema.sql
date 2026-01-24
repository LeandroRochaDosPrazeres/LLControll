-- SQL para adicionar campos de integração com Mercado Livre
-- Execute este SQL no Supabase Dashboard > SQL Editor

-- Adicionar colunas na tabela configuracoes para ML
ALTER TABLE configuracoes 
ADD COLUMN IF NOT EXISTS ml_user_id TEXT,
ADD COLUMN IF NOT EXISTS ml_access_token TEXT,
ADD COLUMN IF NOT EXISTS ml_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS ml_token_expires TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ml_nickname TEXT;

-- Adicionar coluna ml_order_id na tabela vendas (para evitar duplicatas)
ALTER TABLE vendas 
ADD COLUMN IF NOT EXISTS ml_order_id TEXT;

-- Criar índice para busca rápida por ml_id nos produtos
CREATE INDEX IF NOT EXISTS idx_produtos_ml_id ON produtos(ml_id);

-- Criar índice para busca por ml_order_id nas vendas
CREATE INDEX IF NOT EXISTS idx_vendas_ml_order_id ON vendas(ml_order_id);

-- Criar índice para busca por ml_user_id nas configuracoes
CREATE INDEX IF NOT EXISTS idx_configuracoes_ml_user_id ON configuracoes(ml_user_id);
