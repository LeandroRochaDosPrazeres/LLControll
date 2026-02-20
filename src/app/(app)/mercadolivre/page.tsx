'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package,
  ShoppingCart,
  MessageCircle,
  TrendingUp,
  DollarSign,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Star,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  Truck,
  Eye,
  BarChart3,
  Users,
  Bell,
  Search
} from 'lucide-react';
import { Card, Button, useToast } from '@/components/ui';
import { formatarMoeda } from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/helpers';
import { emitStockSynced } from '@/lib/utils/events';

interface MLAnuncio {
  id: string;
  title: string;
  price: number;
  available_quantity: number;
  sold_quantity: number;
  thumbnail: string;
  permalink: string;
  status: string;
  health?: number;
  visits?: number;
}

interface MLVenda {
  id: number;
  status: string;
  date_created: string;
  total_amount: number;
  buyer: {
    nickname: string;
  };
  order_items: {
    item: { title: string };
    quantity: number;
    unit_price: number;
  }[];
}

interface MLPergunta {
  id: number;
  text: string;
  status: string;
  date_created: string;
  item_id: string;
}

interface MLMensagem {
  id: string;
  text: string;
  date_created: string;
  from: { user_id: number };
}

interface MLResumo {
  totalAnuncios: number;
  anunciosAtivos: number;
  totalVendas30d: number;
  faturamento30d: number;
  perguntasPendentes: number;
  mensagensNaoLidas: number;
  reputacao: number;
  visitas30d: number;
}

type TabType = 'resumo' | 'anuncios' | 'vendas' | 'mensagens' | 'perguntas';

export default function MercadoLivrePage() {
  const [activeTab, setActiveTab] = useState<TabType>('resumo');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mlConnected, setMlConnected] = useState(false);
  const [mlNickname, setMlNickname] = useState('');
  const [userId, setUserId] = useState('');
  
  const [resumo, setResumo] = useState<MLResumo>({
    totalAnuncios: 0,
    anunciosAtivos: 0,
    totalVendas30d: 0,
    faturamento30d: 0,
    perguntasPendentes: 0,
    mensagensNaoLidas: 0,
    reputacao: 0,
    visitas30d: 0,
  });
  
  const [anuncios, setAnuncios] = useState<MLAnuncio[]>([]);
  const [vendas, setVendas] = useState<MLVenda[]>([]);
  const [perguntas, setPerguntas] = useState<MLPergunta[]>([]);

  const { addToast } = useToast();

  useEffect(() => {
    checkMLConnection();
  }, []);

  const checkMLConnection = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        
        const { data: config } = await supabase
          .from('configuracoes')
          .select('ml_user_id, ml_nickname, ml_access_token')
          .eq('user_id', user.id)
          .single();
        
        if (config?.ml_access_token) {
          setMlConnected(true);
          setMlNickname(config.ml_nickname || '');
          // Passar userId diretamente para evitar problema de estado
          await loadAllDataWithUserId(user.id);
        }
      }
    } catch (error) {
      console.error('Erro ao verificar conexão ML:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllDataWithUserId = async (uid: string) => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadAnunciosWithUserId(uid),
        loadVendasWithUserId(uid),
        loadPerguntasWithUserId(uid),
      ]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadAllData = async () => {
    if (!userId) return;
    await loadAllDataWithUserId(userId);
  };

  const loadAnunciosWithUserId = async (uid: string) => {
    try {
      const response = await fetch('/api/mercadolivre/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      });

      if (response.ok) {
        const data = await response.json();
        const items = data.items || [];
        setAnuncios(items);
        
        // Atualizar resumo
        const ativos = items.filter((i: MLAnuncio) => i.status === 'active');
        const totalVisitas = items.reduce((acc: number, i: MLAnuncio) => acc + (i.visits || 0), 0);
        
        setResumo(prev => ({
          ...prev,
          totalAnuncios: items.length,
          anunciosAtivos: ativos.length,
          visitas30d: totalVisitas,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar anúncios:', error);
    }
  };

  const loadVendasWithUserId = async (uid: string) => {
    try {
      const response = await fetch('/api/mercadolivre/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      });

      if (response.ok) {
        const data = await response.json();
        const orders = data.orders || [];
        setVendas(orders);
        
        // Calcular faturamento
        const faturamento = orders.reduce((acc: number, o: MLVenda) => acc + o.total_amount, 0);
        
        setResumo(prev => ({
          ...prev,
          totalVendas30d: orders.length,
          faturamento30d: faturamento,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    }
  };

  const loadPerguntasWithUserId = async (uid: string) => {
    try {
      const response = await fetch('/api/mercadolivre/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: uid }),
      });

      if (response.ok) {
        const data = await response.json();
        const questions = data.questions || [];
        setPerguntas(questions);
        
        const pendentes = questions.filter((q: MLPergunta) => q.status === 'UNANSWERED');
        
        setResumo(prev => ({
          ...prev,
          perguntasPendentes: pendentes.length,
        }));
      }
    } catch (error) {
      console.error('Erro ao carregar perguntas:', error);
    }
  };

  const loadAnuncios = () => loadAnunciosWithUserId(userId);
  const loadVendas = () => loadVendasWithUserId(userId);
  const loadPerguntas = () => loadPerguntasWithUserId(userId);

  const sincronizarEstoque = async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/mercadolivre/sync-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (response.ok) {
        const data = await response.json();
        const d = data.details || {};
        const parts: string[] = [];
        if (d.created > 0) parts.push(`${d.created} criado(s)`);
        if (d.updated > 0) parts.push(`${d.updated} atualizado(s)`);
        if (d.deactivated > 0) parts.push(`${d.deactivated} desativado(s)`);

        addToast({
          type: 'success',
          title: 'Estoque sincronizado!',
          description: parts.length > 0
            ? parts.join(', ')
            : 'Tudo já estava atualizado',
        });

        // Notificar outras abas/páginas que o estoque mudou
        emitStockSynced();

        await loadAnuncios();
      } else {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao sincronizar');
      }
    } catch (error: any) {
      addToast({
        type: 'error',
        title: 'Erro ao sincronizar estoque',
        description: error.message || 'Tente novamente',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const tabs = [
    { id: 'resumo', label: 'Resumo', icon: BarChart3 },
    { id: 'anuncios', label: 'Anúncios', icon: Package },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart },
    { id: 'perguntas', label: 'Perguntas', icon: HelpCircle },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-yellow-500 animate-spin" />
      </div>
    );
  }

  if (!mlConnected) {
    return (
      <div className="min-h-screen bg-gray-50 pt-safe pb-24 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Conecte seu Mercado Livre</h2>
          <p className="text-gray-500 mb-6">
            Conecte sua conta para ver seus anúncios, vendas e mensagens aqui.
          </p>
          <Button fullWidth onClick={() => window.location.href = '/ajustes'}>
            Ir para Ajustes
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-safe pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white px-4 pt-6 pb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Mercado Livre</h1>
            <p className="text-yellow-100 text-sm mt-0.5">@{mlNickname}</p>
          </div>
          <button
            onClick={loadAllData}
            disabled={isRefreshing}
            className="p-2 bg-white/20 rounded-full"
          >
            <RefreshCw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4" />
              <span className="text-xs text-yellow-100">Vendas (30d)</span>
            </div>
            <p className="text-xl font-bold">{resumo.totalVendas30d}</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs text-yellow-100">Faturamento</span>
            </div>
            <p className="text-xl font-bold">{formatarMoeda(resumo.faturamento30d)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 -mt-3">
        <div className="bg-white rounded-xl shadow-sm p-1 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all min-w-max",
                activeTab === tab.id
                  ? "bg-yellow-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'perguntas' && resumo.perguntasPendentes > 0 && (
                <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">
                  {resumo.perguntasPendentes}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 mt-4">
        <AnimatePresence mode="wait">
          {activeTab === 'resumo' && (
            <motion.div
              key="resumo"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Cards de Resumo */}
              <div className="grid grid-cols-2 gap-3">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    <span className="text-xs text-gray-500">Anúncios Ativos</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{resumo.anunciosAtivos}</p>
                  <p className="text-xs text-gray-400">de {resumo.totalAnuncios} total</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-5 h-5 text-purple-600" />
                    <span className="text-xs text-gray-500">Visitas</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{resumo.visitas30d}</p>
                  <p className="text-xs text-gray-400">últimos 30 dias</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <HelpCircle className="w-5 h-5 text-orange-600" />
                    <span className="text-xs text-gray-500">Perguntas</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{resumo.perguntasPendentes}</p>
                  <p className="text-xs text-gray-400">pendentes</p>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="text-xs text-gray-500">Ticket Médio</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {resumo.totalVendas30d > 0 
                      ? formatarMoeda(resumo.faturamento30d / resumo.totalVendas30d)
                      : 'R$ 0'}
                  </p>
                  <p className="text-xs text-gray-400">por venda</p>
                </Card>
              </div>

              {/* Ações Rápidas */}
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">⚡ Ações Rápidas</h3>
                <div className="space-y-2">
                  <button
                    onClick={sincronizarEstoque}
                    disabled={isRefreshing}
                    className="w-full flex items-center justify-between p-3 bg-yellow-50 rounded-xl text-left hover:bg-yellow-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <RefreshCw className={cn("w-5 h-5 text-yellow-600", isRefreshing && "animate-spin")} />
                      <div>
                        <p className="font-medium text-gray-900">Sincronizar Estoque</p>
                        <p className="text-xs text-gray-500">Importar produtos do ML</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>

                  <a
                    href="https://www.mercadolivre.com.br/vendas/listagem"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-xl text-left hover:bg-blue-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <ExternalLink className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-gray-900">Abrir Mercado Livre</p>
                        <p className="text-xs text-gray-500">Ir para o painel de vendas</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </a>
                </div>
              </Card>

              {/* Últimas Vendas */}
              {vendas.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-900">🛒 Últimas Vendas</h3>
                    <button 
                      onClick={() => setActiveTab('vendas')}
                      className="text-xs text-yellow-600 font-medium"
                    >
                      Ver todas
                    </button>
                  </div>
                  <div className="space-y-3">
                    {vendas.slice(0, 3).map((venda) => (
                      <div key={venda.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          venda.status === 'paid' ? "bg-green-100" : "bg-yellow-100"
                        )}>
                          {venda.status === 'paid' ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-yellow-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {venda.order_items[0]?.item.title || 'Venda'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {venda.buyer.nickname} • {new Date(venda.date_created).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-green-600">
                          {formatarMoeda(venda.total_amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'anuncios' && (
            <motion.div
              key="anuncios"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{anuncios.length} anúncios</p>
                <Button size="sm" onClick={sincronizarEstoque} disabled={isRefreshing}>
                  <RefreshCw className={cn("w-4 h-4 mr-1", isRefreshing && "animate-spin")} />
                  Sincronizar
                </Button>
              </div>

              {anuncios.map((anuncio) => (
                <Card key={anuncio.id} className="p-3">
                  <div className="flex gap-3">
                    {anuncio.thumbnail && (
                      <img
                        src={anuncio.thumbnail.replace('http://', 'https://')}
                        alt={anuncio.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                          {anuncio.title}
                        </p>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full whitespace-nowrap",
                          anuncio.status === 'active' 
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        )}>
                          {anuncio.status === 'active' ? 'Ativo' : anuncio.status}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-gray-900 mt-1">
                        {formatarMoeda(anuncio.price)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {anuncio.available_quantity} disp.
                        </span>
                        <span className="flex items-center gap-1">
                          <ShoppingCart className="w-3 h-3" />
                          {anuncio.sold_quantity} vendidos
                        </span>
                      </div>
                    </div>
                  </div>
                  <a
                    href={anuncio.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center justify-center gap-1 text-xs text-yellow-600 font-medium py-2 bg-yellow-50 rounded-lg"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver no Mercado Livre
                  </a>
                </Card>
              ))}

              {anuncios.length === 0 && (
                <Card className="p-8 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhum anúncio encontrado</p>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'vendas' && (
            <motion.div
              key="vendas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <p className="text-sm text-gray-500">{vendas.length} vendas recentes</p>

              {vendas.map((venda) => (
                <Card key={venda.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center",
                        venda.status === 'paid' ? "bg-green-100" : 
                        venda.status === 'cancelled' ? "bg-red-100" : "bg-yellow-100"
                      )}>
                        {venda.status === 'paid' ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : venda.status === 'cancelled' ? (
                          <XCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Venda #{venda.id}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(venda.date_created).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {formatarMoeda(venda.total_amount)}
                    </span>
                  </div>
                  
                  <div className="border-t pt-2 mt-2">
                    {venda.order_items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm py-1">
                        <span className="text-gray-600 truncate flex-1">
                          {item.quantity}x {item.item.title}
                        </span>
                        <span className="text-gray-900 font-medium ml-2">
                          {formatarMoeda(item.unit_price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                    <Users className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500">
                      Comprador: {venda.buyer.nickname}
                    </span>
                  </div>
                </Card>
              ))}

              {vendas.length === 0 && (
                <Card className="p-8 text-center">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma venda encontrada</p>
                </Card>
              )}
            </motion.div>
          )}

          {activeTab === 'perguntas' && (
            <motion.div
              key="perguntas"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              <p className="text-sm text-gray-500">
                {resumo.perguntasPendentes} perguntas pendentes
              </p>

              {perguntas.map((pergunta) => (
                <Card key={pergunta.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                      pergunta.status === 'UNANSWERED' ? "bg-orange-100" : "bg-green-100"
                    )}>
                      {pergunta.status === 'UNANSWERED' ? (
                        <HelpCircle className="w-4 h-4 text-orange-600" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{pergunta.text}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(pergunta.date_created).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {pergunta.status === 'UNANSWERED' && (
                    <a
                      href={`https://www.mercadolivre.com.br/perguntas/produto/${pergunta.item_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-1 text-xs text-yellow-600 font-medium py-2 bg-yellow-50 rounded-lg"
                    >
                      <MessageCircle className="w-3 h-3" />
                      Responder no ML
                    </a>
                  )}
                </Card>
              ))}

              {perguntas.length === 0 && (
                <Card className="p-8 text-center">
                  <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Nenhuma pergunta</p>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
