'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingCart,
  Target,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { Card } from '@/components/ui';
import { formatarMoeda } from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';

interface DashboardResumo {
  faturamento: number;
  gastoEstoque: number;
  totalTaxas: number;
  lucroLiquido: number;
  totalVendas: number;
  ticketMedio: number;
}

interface DadoGrafico {
  label: string;
  faturamento: number;
  lucro: number;
  vendas: number;
}

type PeriodoTipo = 'hoje' | 'semana' | 'mes' | 'personalizado';

export default function DashboardPage() {
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
  
  const [resumo, setResumo] = useState<DashboardResumo>({
    faturamento: 0,
    gastoEstoque: 0,
    totalTaxas: 0,
    lucroLiquido: 0,
    totalVendas: 0,
    ticketMedio: 0,
  });
  const [dadosGrafico, setDadosGrafico] = useState<DadoGrafico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metaDiaria, setMetaDiaria] = useState(100);
  const [totalProdutos, setTotalProdutos] = useState(0);

  useEffect(() => {
    carregarDados();
    carregarMeta();
    carregarProdutos();
  }, [periodo, dataInicio, dataFim]);

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

  const carregarMeta = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('configuracoes')
        .select('meta_diaria')
        .single();
      
      if (data?.meta_diaria) {
        setMetaDiaria(Number(data.meta_diaria));
      }
    } catch (error) {
      console.error('Erro ao carregar meta:', error);
    }
  };

  const carregarProdutos = async () => {
    try {
      const supabase = getSupabaseClient();
      const { count } = await supabase
        .from('produtos')
        .select('*', { count: 'exact', head: true })
        .eq('ativo', true);
      
      setTotalProdutos(count || 0);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    }
  };

  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { inicio, fim } = getDateRange();

      const { data: vendasData, error } = await supabase
        .from('vendas')
        .select('*')
        .gte('data_venda', inicio.toISOString())
        .lte('data_venda', fim.toISOString())
        .order('data_venda', { ascending: true });

      if (error) throw error;

      const vendas = vendasData || [];

      if (vendas.length > 0) {
        const faturamento = vendas.reduce((acc: number, v: any) => acc + Number(v.valor_final), 0);
        const gastoEstoque = vendas.reduce((acc: number, v: any) => acc + (Number(v.custo_unitario) * v.qtd_vendida), 0);
        const totalTaxas = vendas.reduce((acc: number, v: any) => {
          const taxaPerc = (Number(v.taxa_percentual) / 100) * Number(v.valor_final);
          return acc + taxaPerc + Number(v.taxa_fixa || 0);
        }, 0);
        const lucroLiquido = vendas.reduce((acc: number, v: any) => acc + Number(v.lucro_liquido), 0);

        setResumo({
          faturamento,
          gastoEstoque,
          totalTaxas,
          lucroLiquido,
          totalVendas: vendas.length,
          ticketMedio: faturamento / vendas.length,
        });

        // Agrupar por dia para gráfico
        const grupos: Record<string, { faturamento: number; lucro: number; vendas: number }> = {};
        vendas.forEach((v: any) => {
          const data = new Date(v.data_venda).toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit' 
          });
          if (!grupos[data]) {
            grupos[data] = { faturamento: 0, lucro: 0, vendas: 0 };
          }
          grupos[data].faturamento += Number(v.valor_final);
          grupos[data].lucro += Number(v.lucro_liquido);
          grupos[data].vendas += 1;
        });

        const dadosOrdenados = Object.entries(grupos).map(([label, dados]) => ({
          label,
          ...dados,
        }));
        setDadosGrafico(dadosOrdenados);
      } else {
        setResumo({
          faturamento: 0,
          gastoEstoque: 0,
          totalTaxas: 0,
          lucroLiquido: 0,
          totalVendas: 0,
          ticketMedio: 0,
        });
        setDadosGrafico([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const progressoMeta = metaDiaria > 0 ? Math.min((resumo.lucroLiquido / metaDiaria) * 100, 100) : 0;

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
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white px-4 pt-6 pb-16 rounded-b-3xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-primary-200 mt-1">Acompanhe suas vendas</p>
        </motion.div>

        {/* Seletor de Período */}
        <div className="mt-4 flex gap-2 flex-wrap">
          {['hoje', 'semana', 'mes'].map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p as PeriodoTipo);
                setShowDatePicker(false);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                periodo === p
                  ? 'bg-white text-primary-600'
                  : 'bg-white/20 text-white'
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
                ? 'bg-white text-primary-600'
                : 'bg-white/20 text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Período
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Date Picker */}
        {showDatePicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 bg-white/10 backdrop-blur-sm rounded-xl p-4"
          >
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-xs text-primary-200 mb-1">De</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white text-gray-900 text-sm"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-primary-200 mb-1">Até</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white text-gray-900 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => setShowDatePicker(false)}
              className="mt-3 w-full py-2 bg-white text-primary-600 rounded-lg font-medium text-sm"
            >
              Aplicar Filtro
            </button>
          </motion.div>
        )}

        {/* Meta do Dia */}
        {periodo === 'hoje' && metaDiaria > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                <span className="text-sm font-medium">Meta do Dia</span>
              </div>
              <span className="text-lg font-bold">
                {formatarMoeda(resumo.lucroLiquido)} / {formatarMoeda(metaDiaria)}
              </span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressoMeta}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`h-full rounded-full ${
                  progressoMeta >= 100 ? 'bg-green-400' : 'bg-white'
                }`}
              />
            </div>
            <p className="text-xs text-primary-200 mt-2">
              {progressoMeta >= 100 
                ? '🎉 Meta atingida!' 
                : `${progressoMeta.toFixed(0)}% da meta`
              }
            </p>
          </motion.div>
        )}
      </div>

      {/* Cards de Resumo */}
      <div className="px-4 -mt-8">
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-green-100 rounded-lg">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-xs text-gray-500">Faturamento</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {formatarMoeda(resumo.faturamento)}
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500">Lucro Líquido</span>
              </div>
              <p className={`text-lg font-bold ${resumo.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(resumo.lucroLiquido)}
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ShoppingCart className="w-4 h-4 text-purple-600" />
                </div>
                <span className="text-xs text-gray-500">Vendas</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {resumo.totalVendas}
              </p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Package className="w-4 h-4 text-orange-600" />
                </div>
                <span className="text-xs text-gray-500">Produtos</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                {totalProdutos}
              </p>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Detalhes Financeiros */}
      <div className="px-4 mt-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Detalhes - {getPeriodoLabel()}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Faturamento Bruto</span>
              <span className="text-sm font-medium text-gray-900">
                {formatarMoeda(resumo.faturamento)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">(-) Custo dos Produtos</span>
              <span className="text-sm font-medium text-red-600">
                -{formatarMoeda(resumo.gastoEstoque)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">(-) Taxas ML</span>
              <span className="text-sm font-medium text-red-600">
                -{formatarMoeda(resumo.totalTaxas)}
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-900">Lucro Líquido</span>
              <span className={`text-lg font-bold ${resumo.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(resumo.lucroLiquido)}
              </span>
            </div>
            {resumo.totalVendas > 0 && (
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span>Ticket Médio</span>
                <span>{formatarMoeda(resumo.ticketMedio)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Gráfico */}
      {dadosGrafico.length > 0 && (
        <div className="px-4 mt-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Evolução - {getPeriodoLabel()}
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico}>
                  <XAxis 
                    dataKey="label" 
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: '#9CA3AF' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `R$${value}`}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [
                      formatarMoeda(value),
                      name === 'faturamento' ? 'Faturamento' : 'Lucro'
                    ]}
                    contentStyle={{
                      borderRadius: '8px',
                      border: 'none',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar 
                    dataKey="faturamento" 
                    fill="#3B82F6" 
                    radius={[4, 4, 0, 0]}
                    name="Faturamento"
                  />
                  <Bar 
                    dataKey="lucro" 
                    fill="#10B981" 
                    radius={[4, 4, 0, 0]}
                    name="Lucro"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded" />
                <span className="text-xs text-gray-500">Faturamento</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded" />
                <span className="text-xs text-gray-500">Lucro</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Mensagem quando não há dados */}
      {!isLoading && resumo.totalVendas === 0 && (
        <div className="px-4 mt-6">
          <Card className="p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-500 font-medium">Nenhuma venda encontrada</h3>
            <p className="text-sm text-gray-400 mt-1">
              Registre vendas no Estoque para ver os dados aqui
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
