'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Package, AlertCircle } from 'lucide-react';
import { 
  Button, 
  Input, 
  Card, 
  Modal, 
  SwipeableItem, 
  ConfirmModal,
  ImageUpload,
  useToast 
} from '@/components/ui';
import { 
  formatarMoeda, 
  formatarPercentual, 
  calcularLucroUnitario,
  getCorLucro,
  getBgCorLucro 
} from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Produto, ProdutoInsert, TaxaTipo } from '@/types/database';
import { hapticFeedback } from '@/lib/utils/helpers';
import ProdutoForm from './components/ProdutoForm';
import VendaRapidaModal from './components/VendaRapidaModal';

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [filteredProdutos, setFilteredProdutos] = useState<Produto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showVendaModal, setShowVendaModal] = useState(false);
  const [selectedProduto, setSelectedProduto] = useState<Produto | null>(null);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);

  const { addToast } = useToast();

  useEffect(() => {
    carregarProdutos();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = produtos.filter((p) =>
        p.nome.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProdutos(filtered);
    } else {
      setFilteredProdutos(produtos);
    }
  }, [searchQuery, produtos]);

  const carregarProdutos = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      addToast({
        type: 'error',
        title: 'Erro ao carregar produtos',
        description: 'Tente novamente mais tarde',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProduto) return;

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('produtos')
        .update({ ativo: false })
        .eq('id', selectedProduto.id);

      if (error) throw error;

      hapticFeedback('medium');
      setProdutos((prev) => prev.filter((p) => p.id !== selectedProduto.id));
      addToast({
        type: 'success',
        title: 'Produto excluído',
      });
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      addToast({
        type: 'error',
        title: 'Erro ao excluir produto',
      });
    } finally {
      setShowDeleteModal(false);
      setSelectedProduto(null);
    }
  };

  const handleVendaRapida = (produto: Produto) => {
    setSelectedProduto(produto);
    setShowVendaModal(true);
  };

  const handleVendaConfirmada = () => {
    carregarProdutos();
    setShowVendaModal(false);
    setSelectedProduto(null);
  };

  const handleEdit = (produto: Produto) => {
    setEditingProduto(produto);
    setShowAddModal(true);
  };

  const handleProdutoSaved = () => {
    carregarProdutos();
    setShowAddModal(false);
    setEditingProduto(null);
  };

  const estoqueTotal = produtos.reduce((acc, p) => acc + p.quantidade, 0);
  const valorEstoque = produtos.reduce((acc, p) => acc + (p.quantidade * p.valor_pago), 0);

  return (
    <div className="min-h-screen bg-gray-50 pt-safe">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {estoqueTotal} itens • {formatarMoeda(valorEstoque)} em estoque
            </p>
          </div>
          <Button
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => setShowAddModal(true)}
          >
            Novo
          </Button>
        </div>

        {/* Search */}
        <Input
          placeholder="Buscar produto..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          leftIcon={<Search className="w-5 h-5" />}
        />
      </div>

      {/* Products List */}
      <div className="px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : filteredProdutos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum produto encontrado</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchQuery ? 'Tente outra busca' : 'Adicione seu primeiro produto'}
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filteredProdutos.map((produto, index) => {
              const calculo = calcularLucroUnitario(
                produto.valor_venda,
                produto.valor_pago,
                produto.taxa_tipo
              );

              return (
                <motion.div
                  key={produto.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <SwipeableItem
                    onDelete={() => {
                      setSelectedProduto(produto);
                      setShowDeleteModal(true);
                    }}
                    onEdit={() => handleEdit(produto)}
                    onSell={() => handleVendaRapida(produto)}
                  >
                    <Card 
                      className="flex items-center gap-3 cursor-pointer active:bg-gray-50 transition-colors"
                      onClick={() => handleEdit(produto)}
                    >
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                        {produto.foto_url ? (
                          <img
                            src={produto.foto_url}
                            alt={produto.nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {produto.nome}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-500">
                            {formatarMoeda(produto.valor_venda)}
                          </span>
                          <span className="text-xs text-gray-400">•</span>
                          <span className={`text-sm font-medium ${getCorLucro(calculo.lucroUnitario)}`}>
                            Lucro: {formatarMoeda(calculo.lucroUnitario)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            produto.quantidade > 5 
                              ? 'bg-success-100 text-success-700'
                              : produto.quantidade > 0
                              ? 'bg-warning-100 text-warning-700'
                              : 'bg-danger-100 text-danger-700'
                          }`}>
                            {produto.quantidade} un.
                          </span>
                          <span className="text-xs text-gray-400 uppercase">
                            {produto.taxa_tipo}
                          </span>
                        </div>
                      </div>

                      {/* Margin Badge */}
                      <div className={`px-2 py-1 rounded-lg ${getBgCorLucro(calculo.lucroUnitario)}`}>
                        <span className={`text-sm font-bold ${getCorLucro(calculo.lucroUnitario)}`}>
                          {formatarPercentual(calculo.margemPercentual)}
                        </span>
                      </div>
                    </Card>
                  </SwipeableItem>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <Modal
        open={showAddModal}
        onOpenChange={(open) => {
          setShowAddModal(open);
          if (!open) setEditingProduto(null);
        }}
        title={editingProduto ? 'Editar Produto' : 'Novo Produto'}
      >
        <ProdutoForm
          produto={editingProduto}
          onSuccess={handleProdutoSaved}
          onCancel={() => {
            setShowAddModal(false);
            setEditingProduto(null);
          }}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        title="Excluir Produto"
        description={`Tem certeza que deseja excluir "${selectedProduto?.nome}"?`}
        confirmText="Excluir"
        variant="danger"
        onConfirm={handleDelete}
      />

      {/* Venda Rápida Modal */}
      {selectedProduto && (
        <VendaRapidaModal
          open={showVendaModal}
          onOpenChange={setShowVendaModal}
          produto={selectedProduto}
          onSuccess={handleVendaConfirmada}
        />
      )}
    </div>
  );
}
