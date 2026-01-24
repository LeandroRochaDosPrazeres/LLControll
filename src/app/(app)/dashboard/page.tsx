'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  ShoppingCart,
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Tooltip 
} from 'recharts';
import { Tabs, TabContent, StatCard, Card } from '@/components/ui';
import { formatarMoeda, getCorLucro } from '@/lib/utils/calculos';
import { formatarData, gerarLabelsSemanais, PeriodoFiltro } from '@/lib/utils/datas';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Venda, DashboardResumo, DashboardSemanal } from '@/types/database';

const periodTabs = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
];

// Mock data para demonstração (será substituído por dados reais)
const mockSemanais: DashboardSemanal[] = [
  { dia: 'Dom', faturamento: 150, lucro: 45, vendas: 3 },
  { dia: 'Seg', faturamento: 280, lucro: 85, vendas: 5 },
  { dia: 'Ter', faturamento: 320, lucro: 95, vendas: 6 },
  { dia: 'Qua', faturamento: 180, lucro: 55, vendas: 4 },
  { dia: 'Qui', faturamento: 420, lucro: 130, vendas: 8 },
  { dia: 'Sex', faturamento: 380, lucro: 115, vendas: 7 },
  { dia: 'Sáb', faturamento: 520, lucro: 165, vendas: 10 },
];

export default function DashboardPage() {
  const [periodo, setPeriodo] = useState<PeriodoFiltro>('hoje');
  const [resumo, setResumo] = useState<DashboardResumo>({
    faturamento: 0,
    gastoEstoque: 0,
    totalTaxas: 0,
    lucroLiquido: 0,
    totalVendas: 0,
    ticketMedio: 0,
  });
  const [dadosSemanais, setDadosSemanais] = useState<DashboardSemanal[]>(mockSemanais);
  const [isLoading, setIsLoading] = useState(true);
  const [metaDiaria, setMetaDiaria] = useState(500);

  useEffect(() => {
    carregarDados();
  }, [periodo]);

  const carregarDados = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseClient();
      
      // Calcular datas baseado no período
      const agora = new Date();
      let dataInicio: Date;
      
      switch (periodo) {
        case 'hoje':
          dataInicio = new Date(agora.setHours(0, 0, 0, 0));
          break;
        case 'semana':
          dataInicio = new Date(agora);
          dataInicio.setDate(agora.getDate() - 7);
          break;
        case 'mes':
          dataInicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
          break;
        default:
          dataInicio = new Date(agora.setHours(0, 0, 0, 0));
      }

      const { data: vendasData, error } = await supabase
        .from('vendas')
        .select('*')
        .gte('data_venda', dataInicio.toISOString())
        .order('data_venda', { ascending: false });

      if (error) throw error;

      const vendas = vendasData as Venda[] | null;

      if (vendas && vendas.length > 0) {
        const faturamento = vendas.reduce((acc, v) => acc + Number(v.valor_final), 0);
        const gastoEstoque = vendas.reduce((acc, v) => acc + (Number(v.custo_unitario) * v.qtd_vendida), 0);
        const totalTaxas = vendas.reduce((acc, v) => acc + (Number(v.taxa_percentual) / 100 * Number(v.valor_final)) + Number(v.taxa_fixa), 0);
        const lucroLiquido = vendas.reduce((acc, v) => acc + Number(v.lucro_liquido), 0);

        setResumo({
          faturamento,
          gastoEstoque,
          totalTaxas,
          lucroLiquido,
          totalVendas: vendas.length,
          ticketMedio: faturamento / vendas.length,
        });
      } else {
        setResumo({
          faturamento: 0,
          gastoEstoque: 0,
          totalTaxas: 0,
          lucroLiquido: 0,
          totalVendas: 0,
          ticketMedio: 0,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const progressoMeta = metaDiaria > 0 ? Math.min((resumo.lucroLiquido / metaDiaria) * 100, 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 pt-safe">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white px-6 pt-8 pb-12 rounded-b-3xl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-primary-200 mt-1">Acompanhe suas vendas</p>
        </motion.div>

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
                <span className="font-medium">Meta do Dia</span>
              </div>
              <span className="text-lg font-bold">
                {formatarMoeda(resumo.lucroLiquido)} / {formatarMoeda(metaDiaria)}
              </span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressoMeta}%` }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className={`h-full rounded-full ${
                  progressoMeta >= 100 ? 'bg-success-400' : 'bg-white'
                }`}
              />
            </div>
            <p className="text-sm text-primary-200 mt-2">
              {progressoMeta >= 100 
                ? '🎉 Meta alcançada!' 
                : `${progressoMeta.toFixed(0)}% da meta`}
            </p>
          </motion.div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 -mt-6">
        {/* Tabs de período */}
        <Tabs 
          tabs={periodTabs} 
          value={periodo} 
          onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}
        >
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <StatCard
                title="Faturamento"
                value={formatarMoeda(resumo.faturamento)}
                icon={<DollarSign />}
                variant="default"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <StatCard
                title="Lucro Líquido"
                value={formatarMoeda(resumo.lucroLiquido)}
                icon={resumo.lucroLiquido >= 0 ? <TrendingUp /> : <TrendingDown />}
                variant={resumo.lucroLiquido >= 0 ? 'success' : 'danger'}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <StatCard
                title="Gasto Estoque"
                value={formatarMoeda(resumo.gastoEstoque)}
                icon={<Package />}
                variant="warning"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <StatCard
                title="Taxas ML"
                value={formatarMoeda(resumo.totalTaxas)}
                icon={<ShoppingCart />}
                variant="danger"
              />
            </motion.div>
          </div>

          {/* Content específico por tab */}
          <TabContent value="hoje">
            <Card className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Vendas Hoje</p>
                  <p className="text-3xl font-bold text-gray-900">{resumo.totalVendas}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Ticket Médio</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatarMoeda(resumo.ticketMedio)}
                  </p>
                </div>
              </div>
            </Card>
          </TabContent>

          <TabContent value="semana">
            <Card className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                Faturamento Semanal
              </h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosSemanais}>
                    <XAxis 
                      dataKey="dia" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#6B7280' }}
                    />
                    <YAxis 
                      hide 
                    />
                    <Tooltip
                      formatter={(value: number) => formatarMoeda(value)}
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: 'none',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar 
                      dataKey="faturamento" 
                      fill="#3B82F6" 
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Resumo semanal */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-sm text-gray-500">Total Vendas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dadosSemanais.reduce((acc, d) => acc + d.vendas, 0)}
                </p>
              </Card>
              <Card>
                <p className="text-sm text-gray-500">Média Diária</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatarMoeda(dadosSemanais.reduce((acc, d) => acc + d.faturamento, 0) / 7)}
                </p>
              </Card>
            </div>
          </TabContent>

          <TabContent value="mes">
            <Card className="mb-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Resumo do Mês
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Faturamento Total</span>
                  <span className="font-semibold text-gray-900">
                    {formatarMoeda(resumo.faturamento)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Gasto com Estoque</span>
                  <span className="font-semibold text-warning-600">
                    - {formatarMoeda(resumo.gastoEstoque)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Total de Taxas</span>
                  <span className="font-semibold text-danger-600">
                    - {formatarMoeda(resumo.totalTaxas)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-gray-900 font-medium">Lucro Líquido Real</span>
                  <span className={`text-xl font-bold ${getCorLucro(resumo.lucroLiquido)}`}>
                    {formatarMoeda(resumo.lucroLiquido)}
                  </span>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-success-100 rounded-lg">
                    <ArrowUpRight className="w-4 h-4 text-success-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Margem</p>
                    <p className="text-lg font-bold text-success-600">
                      {resumo.faturamento > 0 
                        ? ((resumo.lucroLiquido / resumo.faturamento) * 100).toFixed(1) 
                        : 0}%
                    </p>
                  </div>
                </div>
              </Card>
              <Card>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <ShoppingCart className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Vendas</p>
                    <p className="text-lg font-bold text-gray-900">
                      {resumo.totalVendas}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </TabContent>
        </Tabs>
      </div>
    </div>
  );
}
