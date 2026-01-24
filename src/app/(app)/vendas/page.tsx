'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, 
  TrendingUp, 
  Calendar,
  ChevronDown,
  Package
} from 'lucide-react';
import { Card } from '@/components/ui';
import { formatarMoeda } from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';

interface Venda {
  id: string;
  produto_nome: string;
  qtd_vendida: number;
  valor_final: number;
  lucro_liquido: number;
  data_venda: string;
  taxa_tipo: string;
}

interface VendaAgrupada {
  data: string;
  dataFormatada: string;
  vendas: Venda[];
  totalFaturamento: number;
  totalLucro: number;
}

type PeriodoTipo = 'hoje' | 'semana' | 'mes' | 'personalizado';

export default function VendasPage() {
  const [periodo, setPeriodo] = useState<PeriodoTipo>('mes');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [vendasAgrupadas, setVendasAgrupadas] = useState<VendaAgrupada[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resumo, setResumo] = useState({
    totalVendas: 0,
    faturamento: 0,
    lucro: 0,
  });

  useEffect(() => {
    carregarVendas();
  }, [periodo, dataInicio, dataFim]);

  useEffect(() => {
    agruparVendas();
  }, [vendas]);

  const getDateRange = () => {
    const agora = new Date();
    let inicio: Date;
    let fim = new Date();
    fim.setHours(23, 59, 59, 999);

    switch (periodo) {
      case 'hoje':
        inicio = new Date();
        inicio.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        inicio = new Date();
        inicio.setDate(agora.getDate() - 7);
        inicio.setHours(0, 0, 0, 0);
        break;
      case 'mes':
        inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
        break;
      case 'personalizado':
        inicio = new Date(dataInicio);
        inicio.setHours(0, 0, 0, 0);
        fim = new Date(dataFim);
        fim.setHours(23, 59, 59, 999);
        break;
      default:
        inicio = new Date();
        inicio.setHours(0, 0, 0, 0);
    }

    return { inicio, fim };
  };

  const carregarVendas = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { inicio, fim } = getDateRange();

      const { data, error } = await supabase
        .from('vendas')
        .select('*')
        .gte('data_venda', inicio.toISOString())
        .lte('data_venda', fim.toISOString())
        .order('data_venda', { ascending: false });

      if (error) throw error;

      setVendas(data || []);

      // Calcular resumo
      if (data && data.length > 0) {
        setResumo({
          totalVendas: data.length,
          faturamento: data.reduce((acc: number, v: any) => acc + Number(v.valor_final), 0),
          lucro: data.reduce((acc: number, v: any) => acc + Number(v.lucro_liquido), 0),
        });
      } else {
        setResumo({ totalVendas: 0, faturamento: 0, lucro: 0 });
      }
    } catch (error) {
      console.error('Erro ao carregar vendas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const agruparVendas = () => {
    const grupos: Record<string, Venda[]> = {};

    vendas.forEach((venda) => {
      const data = new Date(venda.data_venda).toDateString();
      if (!grupos[data]) {
        grupos[data] = [];
      }
      grupos[data].push(venda);
    });

    const agrupadas: VendaAgrupada[] = Object.entries(grupos).map(([data, vendas]) => ({
      data,
      dataFormatada: new Date(data).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      }),
      vendas,
      totalFaturamento: vendas.reduce((acc, v) => acc + Number(v.valor_final), 0),
      totalLucro: vendas.reduce((acc, v) => acc + Number(v.lucro_liquido), 0),
    }));

    setVendasAgrupadas(agrupadas);
  };

  const getPeriodoLabel = () => {
    switch (periodo) {
      case 'hoje': return 'Hoje';
      case 'semana': return 'Últimos 7 dias';
      case 'mes': return 'Este mês';
      case 'personalizado': 
        return `${new Date(dataInicio).toLocaleDateString('pt-BR')} - ${new Date(dataFim).toLocaleDateString('pt-BR')}`;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-safe pb-24">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Histórico de vendas realizadas
        </p>
      </div>

      {/* Filtros de Período */}
      <div className="px-4 py-4 bg-white border-b border-gray-100">
        <div className="flex gap-2 flex-wrap">
          {['hoje', 'semana', 'mes'].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p as PeriodoTipo);
                setShowDatePicker(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                periodo === p
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : 'Mês'}
            </button>
          ))}
          <button
            onClick={() => {
              setPeriodo('personalizado');
              setShowDatePicker(!showDatePicker);
            }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
              periodo === 'personalizado'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Período
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Date Picker */}
        <AnimatePresence>
          {showDatePicker && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 bg-gray-50 rounded-xl p-4"
            >
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">De</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Até</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
              </div>
              <button
                onClick={() => setShowDatePicker(false)}
                className="mt-3 w-full py-2 bg-primary-600 text-white rounded-lg font-medium text-sm"
              >
                Aplicar Filtro
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Resumo */}
      <div className="px-4 py-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <ShoppingCart className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{resumo.totalVendas}</p>
            <p className="text-xs text-gray-500">Vendas</p>
          </Card>
          <Card className="p-3 text-center">
            <Package className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{formatarMoeda(resumo.faturamento)}</p>
            <p className="text-xs text-gray-500">Faturamento</p>
          </Card>
          <Card className="p-3 text-center">
            <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className={`text-lg font-bold ${resumo.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatarMoeda(resumo.lucro)}
            </p>
            <p className="text-xs text-gray-500">Lucro</p>
          </Card>
        </div>
      </div>

      {/* Lista de Vendas Agrupadas */}
      <div className="px-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vendasAgrupadas.length === 0 ? (
          <Card className="p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-500 font-medium">Nenhuma venda encontrada</h3>
            <p className="text-sm text-gray-400 mt-1">
              {getPeriodoLabel()}
            </p>
          </Card>
        ) : (
          vendasAgrupadas.map((grupo) => (
            <motion.div
              key={grupo.data}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Data Header */}
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-500 capitalize">
                  {grupo.dataFormatada}
                </h3>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">
                    {grupo.vendas.length} venda{grupo.vendas.length > 1 ? 's' : ''}
                  </span>
                  <span className={`font-medium ${grupo.totalLucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatarMoeda(grupo.totalLucro)}
                  </span>
                </div>
              </div>

              {/* Vendas do dia */}
              <Card className="divide-y divide-gray-100">
                {grupo.vendas.map((venda) => (
                  <div key={venda.id} className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{venda.produto_nome}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {venda.qtd_vendida}x {formatarMoeda(venda.valor_final / venda.qtd_vendida)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          venda.taxa_tipo === 'premium' 
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {venda.taxa_tipo === 'premium' ? 'Premium' : 'Clássico'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-gray-900">
                        {formatarMoeda(venda.valor_final)}
                      </p>
                      <p className={`text-sm ${venda.lucro_liquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {venda.lucro_liquido >= 0 ? '+' : ''}{formatarMoeda(venda.lucro_liquido)}
                      </p>
                    </div>
                  </div>
                ))}
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
