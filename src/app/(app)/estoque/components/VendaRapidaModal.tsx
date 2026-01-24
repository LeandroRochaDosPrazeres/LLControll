'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { Modal, Button, useToast } from '@/components/ui';
import { 
  formatarMoeda, 
  calcularLucroVenda 
} from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Produto, VendaInsert } from '@/types/database';
import { hapticFeedback } from '@/lib/utils/helpers';

interface VendaRapidaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto: Produto;
  onSuccess: () => void;
}

export default function VendaRapidaModal({
  open,
  onOpenChange,
  produto,
  onSuccess,
}: VendaRapidaModalProps) {
  const [quantidade, setQuantidade] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const { addToast } = useToast();

  const calculo = calcularLucroVenda(
    produto.valor_venda,
    produto.valor_pago,
    quantidade,
    produto.taxa_tipo
  );

  const handleQuantidadeChange = (delta: number) => {
    const novaQuantidade = quantidade + delta;
    if (novaQuantidade >= 1 && novaQuantidade <= produto.quantidade) {
      setQuantidade(novaQuantidade);
      hapticFeedback('light');
    }
  };

  const handleConfirmar = async () => {
    if (quantidade > produto.quantidade) {
      addToast({
        type: 'error',
        title: 'Estoque insuficiente',
        description: `Disponível: ${produto.quantidade} un.`,
      });
      return;
    }

    setIsLoading(true);

    try {
      const supabase = getSupabaseClient();

      const vendaData: VendaInsert = {
        produto_id: produto.id,
        produto_nome: produto.nome,
        qtd_vendida: quantidade,
        valor_unitario: produto.valor_venda,
        valor_final: calculo.valorFinal,
        custo_unitario: produto.valor_pago,
        taxa_tipo: produto.taxa_tipo,
        taxa_percentual: calculo.taxaPercentual,
        taxa_fixa: calculo.taxaFixa,
        lucro_liquido: calculo.lucroLiquido,
        origem: 'manual',
      };

      const { error } = await supabase.from('vendas').insert(vendaData);

      if (error) throw error;

      hapticFeedback('heavy');
      addToast({
        type: 'success',
        title: 'Venda registrada!',
        description: `Lucro: ${formatarMoeda(calculo.lucroLiquido)}`,
      });

      onSuccess();
    } catch (error) {
      console.error('Erro ao registrar venda:', error);
      addToast({
        type: 'error',
        title: 'Erro ao registrar venda',
        description: 'Tente novamente',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar Venda"
      description={produto.nome}
    >
      <div className="space-y-6">
        {/* Quantidade Selector */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => handleQuantidadeChange(-1)}
            disabled={quantidade <= 1}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-40 active:scale-90 transition-transform"
          >
            <Minus className="w-5 h-5" />
          </button>
          
          <div className="text-center">
            <motion.span
              key={quantidade}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-4xl font-bold text-gray-900"
            >
              {quantidade}
            </motion.span>
            <p className="text-sm text-gray-500 mt-1">
              de {produto.quantidade} disponíveis
            </p>
          </div>
          
          <button
            onClick={() => handleQuantidadeChange(1)}
            disabled={quantidade >= produto.quantidade}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 disabled:opacity-40 active:scale-90 transition-transform"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Resumo */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Valor da Venda</span>
            <span className="font-medium text-gray-900">
              {formatarMoeda(calculo.valorFinal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Custo dos Produtos</span>
            <span className="text-gray-900">
              - {formatarMoeda(calculo.custoTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Taxas ML ({calculo.taxaPercentual}%)</span>
            <span className="text-gray-900">
              - {formatarMoeda(calculo.totalTaxas)}
            </span>
          </div>
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="font-semibold text-gray-900">Lucro Líquido</span>
            <span className={`text-xl font-bold ${
              calculo.lucroLiquido >= 0 ? 'text-success-600' : 'text-danger-600'
            }`}>
              {formatarMoeda(calculo.lucroLiquido)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            fullWidth
            isLoading={isLoading}
            leftIcon={<ShoppingCart className="w-5 h-5" />}
            onClick={handleConfirmar}
          >
            Confirmar Venda
          </Button>
        </div>
      </div>
    </Modal>
  );
}
