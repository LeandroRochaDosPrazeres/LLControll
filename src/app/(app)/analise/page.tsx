'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Target,
  BarChart3,
  Calculator,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  Info,
  Truck,
  Award,
  ShoppingBag
} from 'lucide-react';
import { Card, Button, Input, useToast } from '@/components/ui';
import {
  formatarMoeda,
  formatarPercentual,
  calcularValorMaximoCompra,
  gerarCenariosMargem,
  avaliarCompetitividade,
  calcularMargemPossivel,
  TAXAS_PADRAO
} from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Produto, TaxaTipo } from '@/types/database';
import { cn } from '@/lib/utils/helpers';

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

type TabType = 'meus-anuncios' | 'oportunidades';

export default function AnalisePage() {
  const [activeTab, setActiveTab] = useState<TabType>('oportunidades');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [resultadoAnalise, setResultadoAnalise] = useState<AnaliseResultado | null>(null);
  const [margemDesejada, setMargemDesejada] = useState(20);
  const [taxaTipo, setTaxaTipo] = useState<TaxaTipo>('classico');
  const [showCenarios, setShowCenarios] = useState(false);
  const [meusProdutos, setMeusProdutos] = useState<Produto[]>([]);
  const [isLoadingProdutos, setIsLoadingProdutos] = useState(false);
  const [produtoAnalisando, setProdutoAnalisando] = useState<string | null>(null);
  const [analisesProdutos, setAnalisesProdutos] = useState<Record<string, AnaliseResultado>>({});
  const [userId, setUserId] = useState<string | null>(null);
  
  const { addToast } = useToast();

  // Obter userId do usuário logado
  useEffect(() => {
    const getUserId = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUserId();
  }, []);

  // Carregar produtos do usuário
  useEffect(() => {
    if (activeTab === 'meus-anuncios') {
      carregarMeusProdutos();
    }
  }, [activeTab]);

  const carregarMeusProdutos = async () => {
    setIsLoadingProdutos(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setMeusProdutos(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      addToast({ type: 'error', title: 'Erro ao carregar produtos' });
    } finally {
      setIsLoadingProdutos(false);
    }
  };

  const buscarAnalise = async (query: string, itemId?: string) => {
    if (!query.trim() && !itemId) return;

    setIsSearching(true);
    try {
      // Buscar userId diretamente para garantir que está disponível
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const currentUserId = user?.id;
      
      if (!currentUserId) {
        throw new Error('Usuário não autenticado');
      }

      // Usar POST como as outras APIs do ML que funcionam
      const response = await fetch('/api/mercadolivre/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUserId,
          query: query || undefined,
          item_id: itemId || undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro na busca');
      }

      const data: AnaliseResultado = await response.json();
      setResultadoAnalise(data);

      if (itemId) {
        setAnalisesProdutos((prev) => ({ ...prev, [itemId]: data }));
      }
    } catch (error: any) {
      console.error('Erro na busca:', error);
      addToast({ type: 'error', title: error.message || 'Erro ao buscar no Mercado Livre' });
    } finally {
      setIsSearching(false);
      setProdutoAnalisando(null);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    buscarAnalise(searchQuery);
  };

  const analisarProduto = async (produto: Produto) => {
    setProdutoAnalisando(produto.id);
    if (produto.ml_id) {
      await buscarAnalise('', produto.ml_id);
    } else {
      await buscarAnalise(produto.nome);
    }
  };

  const getStatusBadge = (status: 'excelente' | 'bom' | 'regular' | 'alto' | 'muito_alto') => {
    const styles = {
      excelente: 'bg-green-100 text-green-700',
      bom: 'bg-blue-100 text-blue-700',
      regular: 'bg-yellow-100 text-yellow-700',
      alto: 'bg-orange-100 text-orange-700',
      muito_alto: 'bg-red-100 text-red-700',
    };
    const labels = {
      excelente: 'Excelente',
      bom: 'Bom',
      regular: 'Regular',
      alto: 'Alto',
      muito_alto: 'Muito Alto',
    };
    return (
      <span className={cn('px-2 py-1 rounded-full text-xs font-medium', styles[status])}>
        {labels[status]}
      </span>
    );
  };

  // Calcular valor máximo de compra baseado na análise
  const calculoReverso = resultadoAnalise
    ? calcularValorMaximoCompra(resultadoAnalise.precoMediano, margemDesejada, taxaTipo)
    : null;

  const cenariosMargem = resultadoAnalise
    ? gerarCenariosMargem(resultadoAnalise.precoMediano, taxaTipo)
    : [];

  return (
    <div className="min-h-screen bg-gray-50 pt-safe pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Análise de Mercado</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Precificação inteligente e oportunidades
        </p>
      </div>

      {/* Tabs */}
      <div className="px-4 py-3 bg-white border-b border-gray-100">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('oportunidades')}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === 'oportunidades'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            <Search className="w-4 h-4 inline-block mr-2" />
            Buscar Oportunidades
          </button>
          <button
            onClick={() => setActiveTab('meus-anuncios')}
            className={cn(
              'flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
              activeTab === 'meus-anuncios'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600'
            )}
          >
            <Package className="w-4 h-4 inline-block mr-2" />
            Meus Produtos
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {activeTab === 'oportunidades' ? (
          <div className="space-y-4">
            {/* Busca */}
            <form onSubmit={handleSearch}>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: bicicleta aro 29, fone bluetooth..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-5 h-5" />}
                />
                <Button type="submit" disabled={isSearching || !searchQuery.trim()}>
                  {isSearching ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    'Buscar'
                  )}
                </Button>
              </div>
            </form>

            {/* Configurações de cálculo */}
            <Card className="p-4">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary-600" />
                Configurações de Cálculo
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    Margem Desejada
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="5"
                      max="50"
                      value={margemDesejada}
                      onChange={(e) => setMargemDesejada(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-lg font-bold text-primary-600 w-14 text-right">
                      {margemDesejada}%
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">
                    Tipo de Anúncio
                  </label>
                  <select
                    value={taxaTipo}
                    onChange={(e) => setTaxaTipo(e.target.value as TaxaTipo)}
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="classico">Clássico ({TAXAS_PADRAO.classico}%)</option>
                    <option value="premium">Premium ({TAXAS_PADRAO.premium}%)</option>
                  </select>
                </div>
              </div>
            </Card>

            {/* Resultado da Análise */}
            {resultadoAnalise && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Resumo do Mercado */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary-600" />
                    Análise de Mercado: {resultadoAnalise.query}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    {resultadoAnalise.totalResultados} anúncios analisados
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Preço Mínimo</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatarMoeda(resultadoAnalise.precoMinimo)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs text-gray-500">Preço Máximo</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatarMoeda(resultadoAnalise.precoMaximo)}
                      </p>
                    </div>
                    <div className="bg-primary-50 rounded-xl p-3">
                      <p className="text-xs text-primary-600">Preço Médio</p>
                      <p className="text-lg font-bold text-primary-700">
                        {formatarMoeda(resultadoAnalise.precoMedio)}
                      </p>
                    </div>
                    <div className="bg-primary-50 rounded-xl p-3">
                      <p className="text-xs text-primary-600">Preço Mediano</p>
                      <p className="text-lg font-bold text-primary-700">
                        {formatarMoeda(resultadoAnalise.precoMediano)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 mt-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Truck className="w-4 h-4" />
                      {resultadoAnalise.fretGratisPercentual.toFixed(0)}% frete grátis
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="w-4 h-4" />
                      {resultadoAnalise.vendedoresPremium} vendedores premium
                    </div>
                  </div>
                </Card>

                {/* Cálculo Reverso - Valor Máximo de Compra */}
                {calculoReverso && (
                  <Card className="p-4 border-2 border-green-200 bg-green-50">
                    <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Valor Ideal de Compra
                    </h3>
                    <div className="text-center py-4">
                      <p className="text-sm text-green-600 mb-1">
                        Para vender a {formatarMoeda(resultadoAnalise.precoMediano)} com {margemDesejada}% de margem
                      </p>
                      <p className="text-4xl font-bold text-green-700">
                        {formatarMoeda(calculoReverso.valorMaximoCompra)}
                      </p>
                      <p className="text-sm text-green-600 mt-2">
                        Lucro esperado: {formatarMoeda(calculoReverso.lucroEsperado)} por unidade
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-3 mt-3">
                      <p className="text-xs text-gray-500 mb-2">Detalhamento:</p>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span>Preço de venda:</span>
                          <span className="font-medium">{formatarMoeda(resultadoAnalise.precoMediano)}</span>
                        </div>
                        <div className="flex justify-between text-red-600">
                          <span>Taxa ML ({calculoReverso.taxaPercentual}%):</span>
                          <span>- {formatarMoeda(resultadoAnalise.precoMediano * calculoReverso.taxaPercentual / 100)}</span>
                        </div>
                        {calculoReverso.taxaFixa > 0 && (
                          <div className="flex justify-between text-red-600">
                            <span>Taxa fixa:</span>
                            <span>- {formatarMoeda(calculoReverso.taxaFixa)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-orange-600">
                          <span>Custo máximo:</span>
                          <span>- {formatarMoeda(calculoReverso.valorMaximoCompra)}</span>
                        </div>
                        <div className="flex justify-between text-green-600 font-bold border-t pt-1">
                          <span>Lucro ({margemDesejada}%):</span>
                          <span>= {formatarMoeda(calculoReverso.lucroEsperado)}</span>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Cenários de Margem */}
                <Card className="p-4">
                  <button
                    onClick={() => setShowCenarios(!showCenarios)}
                    className="w-full flex items-center justify-between"
                  >
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-primary-600" />
                      Cenários de Margem
                    </h3>
                    {showCenarios ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  <AnimatePresence>
                    {showCenarios && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 space-y-2">
                          <div className="grid grid-cols-4 text-xs text-gray-500 font-medium px-2">
                            <span>Margem</span>
                            <span>Custo Máx.</span>
                            <span>Lucro</span>
                            <span></span>
                          </div>
                          {cenariosMargem.map((cenario) => (
                            <div
                              key={cenario.margemDesejada}
                              className={cn(
                                'grid grid-cols-4 items-center p-2 rounded-lg text-sm',
                                cenario.margemDesejada === margemDesejada
                                  ? 'bg-primary-100 text-primary-800'
                                  : 'bg-gray-50'
                              )}
                            >
                              <span className="font-medium">{cenario.margemDesejada}%</span>
                              <span>{formatarMoeda(cenario.valorMaximoCompra)}</span>
                              <span className="text-green-600">{formatarMoeda(cenario.lucroEsperado)}</span>
                              {cenario.margemDesejada === margemDesejada && (
                                <CheckCircle className="w-4 h-4 text-primary-600" />
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>

                {/* Preço Sugerido */}
                <Card className="p-4 bg-blue-50 border-2 border-blue-200">
                  <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Preço Sugerido para Venda
                  </h3>
                  <p className="text-3xl font-bold text-blue-700">
                    {formatarMoeda(resultadoAnalise.precoSugerido)}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    5% abaixo da mediana para melhor competitividade
                  </p>
                </Card>

                {/* Lista de Concorrentes */}
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-primary-600" />
                    Anúncios da Concorrência
                  </h3>
                  <div className="space-y-3">
                    {resultadoAnalise.itens.slice(0, 10).map((item) => (
                      <a
                        key={item.id}
                        href={item.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.title}
                          </p>
                          <p className="text-lg font-bold text-primary-600">
                            {formatarMoeda(item.price)}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{item.sold_quantity} vendidos</span>
                            {item.shipping?.free_shipping && (
                              <span className="text-green-600 flex items-center gap-1">
                                <Truck className="w-3 h-3" /> Frete grátis
                              </span>
                            )}
                          </div>
                        </div>
                        <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Estado vazio */}
            {!resultadoAnalise && !isSearching && (
              <div className="text-center py-12">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Busque um produto para analisar
                </h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  Digite o nome de qualquer produto para ver os preços praticados
                  pela concorrência e calcular seu valor ideal de compra.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Tab Meus Anúncios */
          <div className="space-y-4">
            {isLoadingProdutos ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : meusProdutos.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum produto cadastrado
                </h3>
                <p className="text-gray-500 text-sm">
                  Cadastre produtos no estoque para analisar a concorrência.
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-500 mb-2">
                  {meusProdutos.length} produtos • Clique para analisar
                </div>
                {meusProdutos.map((produto) => {
                  const analise = analisesProdutos[produto.ml_id || produto.id];
                  const competitividade = analise
                    ? avaliarCompetitividade(
                        produto.valor_venda,
                        analise.precoMedio,
                        analise.precoMediano,
                        analise.precoMinimo
                      )
                    : null;

                  return (
                    <Card key={produto.id} className="p-4">
                      <div className="flex items-start gap-3">
                        {produto.foto_url ? (
                          <img
                            src={produto.foto_url}
                            alt={produto.nome}
                            className="w-16 h-16 object-cover rounded-lg"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{produto.nome}</h3>
                          <p className="text-lg font-bold text-primary-600">
                            {formatarMoeda(produto.valor_venda)}
                          </p>
                          <p className="text-xs text-gray-500">
                            Custo: {formatarMoeda(produto.valor_pago)} • {produto.taxa_tipo}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => analisarProduto(produto)}
                          disabled={produtoAnalisando === produto.id}
                        >
                          {produtoAnalisando === produto.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <BarChart3 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      {/* Resultado da análise */}
                      {analise && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-4 pt-4 border-t border-gray-100"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-medium text-gray-700">
                              Análise de Competitividade
                            </span>
                            {competitividade && getStatusBadge(competitividade.status)}
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="bg-gray-50 rounded-lg p-2">
                              <p className="text-xs text-gray-500">Mínimo</p>
                              <p className="font-semibold text-sm">
                                {formatarMoeda(analise.precoMinimo)}
                              </p>
                            </div>
                            <div className="bg-primary-50 rounded-lg p-2">
                              <p className="text-xs text-primary-600">Mediana</p>
                              <p className="font-semibold text-sm text-primary-700">
                                {formatarMoeda(analise.precoMediano)}
                              </p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-2">
                              <p className="text-xs text-gray-500">Máximo</p>
                              <p className="font-semibold text-sm">
                                {formatarMoeda(analise.precoMaximo)}
                              </p>
                            </div>
                          </div>

                          {competitividade && (
                            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="text-sm text-gray-700">
                                    {competitividade.recomendacao}
                                  </p>
                                  {competitividade.diferencaPercentual !== 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Seu preço está{' '}
                                      <span
                                        className={cn(
                                          'font-medium',
                                          competitividade.diferencaPercentual > 0
                                            ? 'text-red-600'
                                            : 'text-green-600'
                                        )}
                                      >
                                        {Math.abs(competitividade.diferencaPercentual).toFixed(1)}%{' '}
                                        {competitividade.diferencaPercentual > 0 ? 'acima' : 'abaixo'}
                                      </span>{' '}
                                      da mediana
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Preço sugerido */}
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-gray-600">Preço sugerido:</span>
                                  <span className="font-bold text-primary-600">
                                    {formatarMoeda(analise.precoSugerido)}
                                  </span>
                                </div>
                                {analise.precoSugerido !== produto.valor_venda && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {analise.precoSugerido < produto.valor_venda ? (
                                      <span className="text-orange-600">
                                        Considere reduzir {formatarMoeda(produto.valor_venda - analise.precoSugerido)}
                                      </span>
                                    ) : (
                                      <span className="text-green-600">
                                        Pode aumentar até {formatarMoeda(analise.precoSugerido - produto.valor_venda)}
                                      </span>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
