'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShoppingCart, 
  Calendar, 
  TrendingUp, 
  Filter,
  ChevronDown,
  Package
} from 'lucide-react';
import { Card, Tabs, TabContent, Button } from '@/components/ui';
import { formatarMoeda, getCorLucro } from '@/lib/utils/calculos';
import { formatarData, formatarHora, PeriodoFiltro, getDateRange } from '@/lib/utils/datas';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Venda } from '@/types/database';

const periodTabs = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
];

interface VendaAgrupada {
  data: string;
  vendas: Venda[];
  totalFaturamento: number;
  totalLucro: number;
}

export default function VendasPage() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje');
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
  }, [periodo]);

  useEffect(() => {
    agruparVendas();
  }, [vendas]);

  const carregarVendas = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { inicio, fim } = getDateRange(periodo);

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
          faturamento: data.reduce((acc, v) => acc + Number(v.valor_final), 0),
          lucro: data.reduce((acc, v) => acc + Number(v.lucro_liquido), 0),
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
      vendas,
      totalFaturamento: vendas.reduce((acc, v) => acc + Number(v.valor_final), 0),
      totalLucro: vendas.reduce((acc, v) => acc + Number(v.lucro_liquido), 0),
    }));

    setVendasAgrupadas(agrupadas);
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-safe">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendas</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Histórico de vendas realizadas
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Vendas</p>
            <p className="text-lg font-bold text-gray-900">{resumo.totalVendas}</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-500">Faturamento</p>
            <p className="text-lg font-bold text-gray-900">
              {formatarMoeda(resumo.faturamento)}
            </p>
          </div>
          <div className="bg-success-50 rounded-xl p-3 text-center">
            <p className="text-xs text-success-600">Lucro</p>
            <p className="text-lg font-bold text-success-600">
              {formatarMoeda(resumo.lucro)}
            </p>
          </div>
        </div>

        {/* Period Tabs */}
        <Tabs
          tabs={periodTabs}
          value={periodo}
          onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}
        >
          <div />
        </Tabs>
      </div>

      {/* Sales List */}
      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : vendasAgrupadas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhuma venda encontrada</p>
            <p className="text-sm text-gray-400 mt-1">
              As vendas aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {vendasAgrupadas.map((grupo, groupIndex) => (
                <motion.div
                  key={grupo.data}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIndex * 0.1 }}
                >
                  {/* Date Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600">
                        {formatarData(grupo.data)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">
                        {formatarMoeda(grupo.totalFaturamento)}
                      </span>
                      <span className={`font-medium ${getCorLucro(grupo.totalLucro)}`}>
                        {formatarMoeda(grupo.totalLucro)}
                      </span>
                    </div>
                  </div>

                  {/* Sales Cards */}
                  <div className="space-y-2">
                    {grupo.vendas.map((venda, index) => (
                      <motion.div
                        key={venda.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Card className="flex items-center gap-3">
                          {/* Icon */}
                          <div className={`p-2 rounded-xl ${
                            venda.origem === 'mercadolivre' 
                              ? 'bg-yellow-100' 
                              : 'bg-primary-100'
                          }`}>
                            {venda.origem === 'mercadolivre' ? (
                              <Package className="w-5 h-5 text-yellow-600" />
                            ) : (
                              <ShoppingCart className="w-5 h-5 text-primary-600" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-gray-900 truncate">
                              {venda.produto_nome}
                            </h4>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span>{venda.qtd_vendida}x</span>
                              <span>•</span>
                              <span>{formatarHora(venda.data_venda)}</span>
                              <span>•</span>
                              <span className="capitalize">{venda.origem}</span>
                            </div>
                          </div>

                          {/* Values */}
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {formatarMoeda(venda.valor_final)}
                            </p>
                            <p className={`text-sm font-medium ${getCorLucro(venda.lucro_liquido)}`}>
                              {formatarMoeda(venda.lucro_liquido)}
                            </p>
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
