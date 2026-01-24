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
  Calendar,
  ChevronDown,
  Wallet,
  PiggyBank,
  BarChart3,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Box
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card } from '@/components/ui';
import { formatarMoeda, calcularLucroUnitario } from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';

interface DashboardResumo {
  faturamento: number;
  gastoEstoque: number;
  totalTaxas: number;
  lucroLiquido: number;
  totalVendas: number;
  ticketMedio: number;
  quantidadeVendida: number;
}

interface EstoqueInfo {
  totalProdutos: number;
  totalItens: number;
  valorCusto: number;
  valorVenda: number;
  lucroEsperado: number;
  margemMedia: number;
}

interface DadoGrafico {
  label: string;
  faturamento: number;
  lucro: number;
  vendas: number;
}

interface ProdutoTop {
  nome: string;
  vendas: number;
  lucro: number;
}

type PeriodoTipo = 'hoje' | 'semana' | 'mes' | 'personalizado';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
    quantidadeVendida: 0,
  });

  const [estoque, setEstoque] = useState<EstoqueInfo>({
    totalProdutos: 0,
    totalItens: 0,
    valorCusto: 0,
    valorVenda: 0,
    lucroEsperado: 0,
    margemMedia: 0,
  });

  const [produtosTop, setProdutosTop] = useState<ProdutoTop[]>([]);
  const [dadosGrafico, setDadosGrafico] = useState<DadoGrafico[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metaDiaria, setMetaDiaria] = useState(100);
  const [metaMensal, setMetaMensal] = useState(3000);

  useEffect(() => {
    carregarTudo();
  }, [periodo, dataInicio, dataFim]);

  const carregarTudo = async () => {
    setIsLoading(true);
    await Promise.all([
      carregarDados(),
      carregarEstoque(),
      carregarMeta(),
      carregarProdutosTop(),
    ]);
    setIsLoading(false);
  };

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
        .select('meta_diaria, meta_mensal')
        .single();
      
      if (data) {
        setMetaDiaria(Number(data.meta_diaria) || 100);
        setMetaMensal(Number(data.meta_mensal) || 3000);
      }
    } catch (error) {
      console.error('Erro ao carregar meta:', error);
    }
  };

  const carregarEstoque = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: produtos } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true);

      if (produtos && produtos.length > 0) {
        const totalProdutos = produtos.length;
        const totalItens = produtos.reduce((acc: number, p: any) => acc + p.quantidade, 0);
        const valorCusto = produtos.reduce((acc: number, p: any) => acc + (p.quantidade * Number(p.valor_pago)), 0);
        const valorVenda = produtos.reduce((acc: number, p: any) => acc + (p.quantidade * Number(p.valor_venda)), 0);
        
        // Calcular lucro esperado considerando taxas
        let lucroEsperadoTotal = 0;
        let somaMargens = 0;
        
        produtos.forEach((p: any) => {
          const calculo = calcularLucroUnitario(Number(p.valor_venda), Number(p.valor_pago), p.taxa_tipo);
          lucroEsperadoTotal += calculo.lucroUnitario * p.quantidade;
          somaMargens += calculo.margemPercentual;
        });

        const margemMedia = produtos.length > 0 ? somaMargens / produtos.length : 0;

        setEstoque({
          totalProdutos,
          totalItens,
          valorCusto,
          valorVenda,
          lucroEsperado: lucroEsperadoTotal,
          margemMedia,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar estoque:', error);
    }
  };

  const carregarProdutosTop = async () => {
    try {
      const supabase = getSupabaseClient();
      const { inicio, fim } = getDateRange();
      
      const { data: vendas } = await supabase
        .from('vendas')
        .select('produto_nome, qtd_vendida, lucro_liquido')
        .gte('data_venda', inicio.toISOString())
        .lte('data_venda', fim.toISOString());

      if (vendas && vendas.length > 0) {
        // Agrupar por produto
        const grupos: Record<string, { vendas: number; lucro: number }> = {};
        vendas.forEach((v: any) => {
          if (!grupos[v.produto_nome]) {
            grupos[v.produto_nome] = { vendas: 0, lucro: 0 };
          }
          grupos[v.produto_nome].vendas += v.qtd_vendida;
          grupos[v.produto_nome].lucro += Number(v.lucro_liquido);
        });

        const top = Object.entries(grupos)
          .map(([nome, dados]) => ({ nome, ...dados }))
          .sort((a, b) => b.lucro - a.lucro)
          .slice(0, 5);

        setProdutosTop(top);
      } else {
        setProdutosTop([]);
      }
    } catch (error) {
      console.error('Erro ao carregar produtos top:', error);
    }
  };

  const carregarDados = async () => {
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
        const quantidadeVendida = vendas.reduce((acc: number, v: any) => acc + v.qtd_vendida, 0);

        setResumo({
          faturamento,
          gastoEstoque,
          totalTaxas,
          lucroLiquido,
          totalVendas: vendas.length,
          ticketMedio: faturamento / vendas.length,
          quantidadeVendida,
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
          quantidadeVendida: 0,
        });
        setDadosGrafico([]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    }
  };

  const getMeta = () => {
    if (periodo === 'hoje') return metaDiaria;
    if (periodo === 'mes') return metaMensal;
    if (periodo === 'semana') return metaDiaria * 7;
    return metaMensal;
  };

  const progressoMeta = getMeta() > 0 ? Math.min((resumo.lucroLiquido / getMeta()) * 100, 100) : 0;

  const getPeriodoLabel = () => {
    switch (periodo) {
      case 'hoje': return 'Hoje';
      case 'semana': return 'Últimos 7 dias';
      case 'mes': return 'Este mês';
      case 'personalizado': 
        return `${new Date(dataInicio).toLocaleDateString('pt-BR')} - ${new Date(dataFim).toLocaleDateString('pt-BR')}`;
    }
  };

  // ROI = (Lucro / Custo) * 100
  const roi = resumo.gastoEstoque > 0 ? ((resumo.lucroLiquido / resumo.gastoEstoque) * 100) : 0;

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
          <p className="text-primary-200 mt-1">Visão completa do seu negócio</p>
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

        {/* Meta Progress */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              <span className="text-sm font-medium">Meta {periodo === 'hoje' ? 'Diária' : periodo === 'mes' ? 'Mensal' : 'do Período'}</span>
            </div>
            <span className="text-lg font-bold">
              {formatarMoeda(resumo.lucroLiquido)} / {formatarMoeda(getMeta())}
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
      </div>

      {/* Cards Principais - Lucro Real vs Esperado */}
      <div className="px-4 -mt-8">
        <div className="grid grid-cols-2 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="p-4 border-l-4 border-l-green-500">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-500">Lucro Real</span>
              </div>
              <p className={`text-xl font-bold ${resumo.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(resumo.lucroLiquido)}
              </p>
              <p className="text-xs text-gray-400 mt-1">{getPeriodoLabel()}</p>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-500">Lucro Esperado</span>
              </div>
              <p className="text-xl font-bold text-blue-600">
                {formatarMoeda(estoque.lucroEsperado)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Se vender todo estoque</p>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* Cards Estoque */}
      <div className="px-4 mt-4">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">💼 Estoque</h3>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Box className="w-4 h-4 text-orange-600" />
              <span className="text-xs text-gray-500">Valor Custo</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {formatarMoeda(estoque.valorCusto)}
            </p>
            <p className="text-xs text-gray-400 mt-1">{estoque.totalItens} itens</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-500">Valor Venda</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {formatarMoeda(estoque.valorVenda)}
            </p>
            <p className="text-xs text-gray-400 mt-1">Potencial bruto</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-500">Produtos</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {estoque.totalProdutos}
            </p>
            <p className="text-xs text-gray-400 mt-1">Cadastrados</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Percent className="w-4 h-4 text-indigo-600" />
              <span className="text-xs text-gray-500">Margem Média</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {estoque.margemMedia.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">Por produto</p>
          </Card>
        </div>
      </div>

      {/* Cards Vendas do Período */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-gray-600 mb-3">📊 Vendas - {getPeriodoLabel()}</h3>
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 text-center">
            <ShoppingCart className="w-5 h-5 text-purple-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{resumo.totalVendas}</p>
            <p className="text-xs text-gray-500">Vendas</p>
          </Card>

          <Card className="p-3 text-center">
            <Package className="w-5 h-5 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-bold text-gray-900">{resumo.quantidadeVendida}</p>
            <p className="text-xs text-gray-500">Unidades</p>
          </Card>

          <Card className="p-3 text-center">
            <BarChart3 className="w-5 h-5 text-green-600 mx-auto mb-1" />
            <p className={`text-lg font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {roi.toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500">ROI</p>
          </Card>
        </div>
      </div>

      {/* Detalhes Financeiros */}
      <div className="px-4 mt-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            💰 Resumo Financeiro - {getPeriodoLabel()}
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
              <span className="text-sm font-semibold text-gray-900">= Lucro Líquido</span>
              <span className={`text-xl font-bold ${resumo.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarMoeda(resumo.lucroLiquido)}
              </span>
            </div>
            {resumo.totalVendas > 0 && (
              <>
                <div className="border-t pt-3 flex justify-between items-center text-xs text-gray-400">
                  <span>Ticket Médio</span>
                  <span>{formatarMoeda(resumo.ticketMedio)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-gray-400">
                  <span>Lucro por Venda</span>
                  <span>{formatarMoeda(resumo.lucroLiquido / resumo.totalVendas)}</span>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Top Produtos */}
      {produtosTop.length > 0 && (
        <div className="px-4 mt-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              🏆 Top Produtos - {getPeriodoLabel()}
            </h3>
            <div className="space-y-3">
              {produtosTop.map((produto, index) => (
                <div key={produto.nome} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-600' : 'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{produto.nome}</p>
                    <p className="text-xs text-gray-500">{produto.vendas} vendas</p>
                  </div>
                  <span className={`text-sm font-bold ${produto.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatarMoeda(produto.lucro)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Gráfico */}
      {dadosGrafico.length > 0 && (
        <div className="px-4 mt-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              📈 Evolução - {getPeriodoLabel()}
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

      {/* Mensagem quando não há vendas */}
      {!isLoading && resumo.totalVendas === 0 && (
        <div className="px-4 mt-6">
          <Card className="p-8 text-center">
            <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-gray-500 font-medium">Nenhuma venda no período</h3>
            <p className="text-sm text-gray-400 mt-1">
              Registre vendas no Estoque para ver os dados aqui
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
