'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Button, 
  Input, 
  ImageUpload,
  useToast 
} from '@/components/ui';
import { 
  formatarMoeda, 
  formatarPercentual, 
  calcularLucroUnitario 
} from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Produto, ProdutoInsert, TaxaTipo } from '@/types/database';
import { hapticFeedback } from '@/lib/utils/helpers';

interface ProdutoFormProps {
  produto?: Produto | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProdutoForm({ produto, onSuccess, onCancel }: ProdutoFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    quantidade: '',
    valor_pago: '',
    valor_venda: '',
    taxa_tipo: 'classico' as TaxaTipo,
    foto_url: '',
  });

  const { addToast } = useToast();

  useEffect(() => {
    if (produto) {
      setFormData({
        nome: produto.nome,
        quantidade: produto.quantidade.toString(),
        valor_pago: produto.valor_pago.toString(),
        valor_venda: produto.valor_venda.toString(),
        taxa_tipo: produto.taxa_tipo,
        foto_url: produto.foto_url || '',
      });
    }
  }, [produto]);

  const valorPago = parseFloat(formData.valor_pago) || 0;
  const valorVenda = parseFloat(formData.valor_venda) || 0;

  const calculo = calcularLucroUnitario(valorVenda, valorPago, formData.taxa_tipo);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome.trim()) {
      addToast({ type: 'error', title: 'Nome é obrigatório' });
      return;
    }

    if (valorPago <= 0 || valorVenda <= 0) {
      addToast({ type: 'error', title: 'Valores devem ser maiores que zero' });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        addToast({ type: 'error', title: 'Usuário não autenticado' });
        return;
      }

      const produtoData = {
        nome: formData.nome.trim(),
        quantidade: parseInt(formData.quantidade) || 0,
        valor_pago: valorPago,
        valor_venda: valorVenda,
        taxa_tipo: formData.taxa_tipo,
        foto_url: formData.foto_url || null,
        user_id: user.id,
      };

      if (produto) {
        // Update
        const { error } = await supabase
          .from('produtos')
          .update(produtoData)
          .eq('id', produto.id);

        if (error) throw error;

        hapticFeedback('medium');
        addToast({ type: 'success', title: 'Produto atualizado!' });
      } else {
        // Insert
        const { error } = await supabase
          .from('produtos')
          .insert(produtoData as any);

        if (error) throw error;

        hapticFeedback('medium');
        addToast({ type: 'success', title: 'Produto cadastrado!' });
      }

      onSuccess();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      addToast({
        type: 'error',
        title: 'Erro ao salvar produto',
        description: 'Tente novamente',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Image Upload */}
      <div className="flex justify-center">
        <ImageUpload
          value={formData.foto_url}
          onChange={(url) => setFormData((prev) => ({ ...prev, foto_url: url || '' }))}
        />
      </div>

      {/* Nome */}
      <Input
        label="Nome do Produto"
        placeholder="Ex: Camiseta Nike"
        value={formData.nome}
        onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
        required
      />

      {/* Quantidade */}
      <Input
        label="Quantidade Comprada"
        type="number"
        placeholder="0"
        min="0"
        value={formData.quantidade}
        onChange={(e) => setFormData((prev) => ({ ...prev, quantidade: e.target.value }))}
      />

      {/* Valores */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Custo Unitário (R$)"
          type="number"
          placeholder="0,00"
          step="0.01"
          min="0"
          value={formData.valor_pago}
          onChange={(e) => setFormData((prev) => ({ ...prev, valor_pago: e.target.value }))}
          required
        />
        <Input
          label="Preço de Venda (R$)"
          type="number"
          placeholder="0,00"
          step="0.01"
          min="0"
          value={formData.valor_venda}
          onChange={(e) => setFormData((prev) => ({ ...prev, valor_venda: e.target.value }))}
          required
        />
      </div>

      {/* Tipo de Taxa */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Tipo de Anúncio Mercado Livre
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, taxa_tipo: 'classico' }))}
            className={`p-3 rounded-xl border-2 transition-all ${
              formData.taxa_tipo === 'classico'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <span className={`font-medium ${
              formData.taxa_tipo === 'classico' ? 'text-primary-700' : 'text-gray-700'
            }`}>
              Clássico
            </span>
            <span className="block text-sm text-gray-500 mt-0.5">11% de taxa</span>
          </button>
          <button
            type="button"
            onClick={() => setFormData((prev) => ({ ...prev, taxa_tipo: 'premium' }))}
            className={`p-3 rounded-xl border-2 transition-all ${
              formData.taxa_tipo === 'premium'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <span className={`font-medium ${
              formData.taxa_tipo === 'premium' ? 'text-primary-700' : 'text-gray-700'
            }`}>
              Premium
            </span>
            <span className="block text-sm text-gray-500 mt-0.5">16% de taxa</span>
          </button>
        </div>
      </div>

      {/* Preview de Cálculos */}
      {valorVenda > 0 && valorPago > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="p-4 bg-gray-50 rounded-xl space-y-2"
        >
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Taxa ML ({calculo.taxaPercentual}%)</span>
            <span className="text-gray-900">
              - {formatarMoeda((valorVenda * calculo.taxaPercentual) / 100)}
            </span>
          </div>
          {calculo.taxaFixa > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Taxa Fixa</span>
              <span className="text-gray-900">- {formatarMoeda(calculo.taxaFixa)}</span>
            </div>
          )}
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-medium text-gray-700">Lucro por Unidade</span>
            <span className={`font-bold ${
              calculo.lucroUnitario >= 0 ? 'text-success-600' : 'text-danger-600'
            }`}>
              {formatarMoeda(calculo.lucroUnitario)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium text-gray-700">Margem</span>
            <span className={`font-bold ${
              calculo.margemPercentual >= 0 ? 'text-success-600' : 'text-danger-600'
            }`}>
              {formatarPercentual(calculo.margemPercentual)}
            </span>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={onCancel}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          fullWidth
          isLoading={isLoading}
        >
          {produto ? 'Salvar' : 'Cadastrar'}
        </Button>
      </div>
    </form>
  );
}
