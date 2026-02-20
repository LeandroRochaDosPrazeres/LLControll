'use client';

import { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'next/navigation';
import { 
  Settings, 
  Bell, 
  Target, 
  Percent,
  Link2,
  Link2Off,
  LogOut,
  ChevronRight,
  User,
  Info,
  Package,
  RefreshCw,
  Check,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { Card, Button, Input, Modal, useToast } from '@/components/ui';
import { formatarMoeda } from '@/lib/utils/calculos';
import { getSupabaseClient } from '@/lib/supabase/client';
import { Configuracoes } from '@/types/database';
import { cn, hapticFeedback } from '@/lib/utils/helpers';
import { getAuthUrl } from '@/lib/mercadolivre/client';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  onClick?: () => void;
  rightElement?: React.ReactNode;
}

function SettingItem({ icon, title, description, onClick, rightElement }: SettingItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'w-full flex items-center gap-4 p-4 text-left',
        'transition-colors',
        onClick && 'active:bg-gray-50'
      )}
    >
      <div className="p-2 bg-gray-100 rounded-xl">
        {icon}
      </div>
      <div className="flex-1">
        <p className="font-medium text-gray-900">{title}</p>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      {rightElement || (onClick && <ChevronRight className="w-5 h-5 text-gray-400" />)}
    </button>
  );
}

function AjustesContent() {
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<Configuracoes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showMetasModal, setShowMetasModal] = useState(false);
  const [showTaxasModal, setShowTaxasModal] = useState(false);
  const [showContaModal, setShowContaModal] = useState(false);
  const [showMLModal, setShowMLModal] = useState(false);
  const [mlConnected, setMlConnected] = useState(false);
  const [mlNickname, setMlNickname] = useState('');
  const [mlItems, setMlItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [importingItem, setImportingItem] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [metaDiaria, setMetaDiaria] = useState('');
  const [metaMensal, setMetaMensal] = useState('');
  const [taxaClassico, setTaxaClassico] = useState('11');
  const [taxaPremium, setTaxaPremium] = useState('16');
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);

  const { addToast } = useToast();

  useEffect(() => {
    carregarConfiguracoes();
    
    // Verificar retorno do OAuth
    const mlSuccess = searchParams.get('ml_success');
    const mlError = searchParams.get('ml_error');
    const nickname = searchParams.get('nickname');
    
    if (mlSuccess === 'true') {
      addToast({ 
        type: 'success', 
        title: 'Mercado Livre conectado!',
        description: nickname ? `Bem-vindo, ${nickname}` : undefined
      });
      setMlConnected(true);
      if (nickname) setMlNickname(nickname);
      // Limpar URL
      window.history.replaceState({}, '', '/ajustes');
    } else if (mlError) {
      addToast({ 
        type: 'error', 
        title: 'Erro ao conectar ML',
        description: mlError
      });
      window.history.replaceState({}, '', '/ajustes');
    }
  }, [searchParams]);

  const carregarConfiguracoes = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        setUserEmail(user.email || '');
        setUserId(user.id);
        
        const { data, error } = await supabase
          .from('configuracoes')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (data && !error) {
          const configData = data as Configuracoes;
          setConfig(configData);
          setMetaDiaria(configData.meta_diaria?.toString() || '100');
          setMetaMensal(configData.meta_mensal?.toString() || '3000');
          setTaxaClassico(configData.taxa_classico?.toString() || '11');
          setTaxaPremium(configData.taxa_premium?.toString() || '16');
          setNotificacoesAtivas(configData.notificacoes_ativas ?? true);
          
          // Verificar conexão ML
          if ((configData as any).ml_user_id) {
            setMlConnected(true);
            setMlNickname((configData as any).ml_nickname || '');
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const salvarMetas = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        addToast({ type: 'error', title: 'Usuário não autenticado' });
        return;
      }

      const metaDiariaNum = parseFloat(metaDiaria) || 0;
      const metaMensalNum = parseFloat(metaMensal) || 0;

      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          user_id: user.id,
          meta_diaria: metaDiariaNum,
          meta_mensal: metaMensalNum,
        } as any);

      if (error) throw error;

      hapticFeedback('medium');
      addToast({ type: 'success', title: 'Metas atualizadas!' });
      setShowMetasModal(false);
    } catch (error) {
      console.error('Erro ao salvar metas:', error);
      addToast({ type: 'error', title: 'Erro ao salvar metas' });
    }
  };

  const salvarTaxas = async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        addToast({ type: 'error', title: 'Usuário não autenticado' });
        return;
      }

      const { error } = await supabase
        .from('configuracoes')
        .upsert({
          user_id: user.id,
          taxa_classico: parseFloat(taxaClassico) || 11,
          taxa_premium: parseFloat(taxaPremium) || 16,
        } as any);

      if (error) throw error;

      hapticFeedback('medium');
      addToast({ type: 'success', title: 'Taxas atualizadas!' });
      setShowTaxasModal(false);
    } catch (error) {
      console.error('Erro ao salvar taxas:', error);
      addToast({ type: 'error', title: 'Erro ao salvar taxas' });
    }
  };

  const toggleNotificacoes = async (enabled: boolean) => {
    setNotificacoesAtivas(enabled);
    hapticFeedback('light');

    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from('configuracoes')
          .upsert({
            user_id: user.id,
            notificacoes_ativas: enabled,
          } as any);
      }
    } catch (error) {
      console.error('Erro ao atualizar notificações:', error);
    }
  };

  const handleLogout = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleConnectML = () => {
    const authUrl = getAuthUrl(userId);
    window.location.href = authUrl;
  };

  const handleDisconnectML = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('configuracoes')
        .update({
          ml_user_id: null,
          ml_access_token: null,
          ml_refresh_token: null,
          ml_token_expires_at: null,
        } as any)
        .eq('user_id', userId);

      setMlConnected(false);
      setMlNickname('');
      setMlItems([]);
      addToast({ type: 'success', title: 'Mercado Livre desconectado' });
    } catch (error) {
      console.error('Erro ao desconectar ML:', error);
      addToast({ type: 'error', title: 'Erro ao desconectar' });
    }
  };

  const loadMLItems = async () => {
    if (!userId) return;
    
    setLoadingItems(true);
    try {
      const response = await fetch('/api/mercadolivre/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao buscar anúncios');
      }

      const data = await response.json();
      setMlItems(data.items || []);
    } catch (error: any) {
      console.error('Erro ao buscar anúncios:', error);
      addToast({ 
        type: 'error', 
        title: 'Erro ao buscar anúncios',
        description: error.message 
      });
    } finally {
      setLoadingItems(false);
    }
  };

  const importarProdutoML = async (item: any) => {
    setImportingItem(item.id);
    try {
      const supabase = getSupabaseClient();
      
      // Verificar se já existe produto com este ml_id
      const { data: existing } = await supabase
        .from('produtos')
        .select('id')
        .eq('ml_id', item.id)
        .single();

      if (existing) {
        addToast({ 
          type: 'warning', 
          title: 'Produto já importado',
          description: 'Este anúncio já está vinculado a um produto'
        });
        return;
      }

      // Criar produto
      const { error } = await supabase
        .from('produtos')
        .insert({
          user_id: userId,
          nome: item.title,
          foto_url: item.thumbnail?.replace('http://', 'https://') || null,
          quantidade: item.available_quantity,
          valor_pago: 0, // Usuário precisará preencher o custo
          valor_venda: item.price,
          ml_id: item.id,
          taxa_tipo: 'classico',
          ativo: true,
        } as any);

      if (error) throw error;

      addToast({ 
        type: 'success', 
        title: 'Produto importado!',
        description: 'Não esqueça de preencher o custo no Estoque'
      });

      // Marcar como importado na lista
      setMlItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, imported: true } : i
      ));
    } catch (error: any) {
      console.error('Erro ao importar:', error);
      addToast({ type: 'error', title: 'Erro ao importar produto' });
    } finally {
      setImportingItem(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-safe">
      {/* Header */}
      <div className="bg-white px-4 pt-6 pb-4 border-b border-gray-100">
        <h1 className="text-2xl font-bold text-gray-900">Ajustes</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure seu aplicativo
        </p>
      </div>

      {/* Settings Sections */}
      <div className="px-4 py-4 space-y-4">
        {/* Metas */}
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Metas
            </h3>
          </div>
          <SettingItem
            icon={<Target className="w-5 h-5 text-primary-600" />}
            title="Metas de Lucro"
            description={
              config?.meta_diaria 
                ? `Diária: ${formatarMoeda(config.meta_diaria)}`
                : 'Definir metas diárias e mensais'
            }
            onClick={() => setShowMetasModal(true)}
          />
        </Card>

        {/* Mercado Livre */}
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
            <h3 className="text-sm font-semibold text-yellow-700 uppercase tracking-wide flex items-center gap-2">
              <span className="text-lg">🛒</span> Mercado Livre
            </h3>
          </div>
          <SettingItem
            icon={<Percent className="w-5 h-5 text-yellow-600" />}
            title="Taxas Personalizadas"
            description={`Clássico: ${taxaClassico}% • Premium: ${taxaPremium}%`}
            onClick={() => setShowTaxasModal(true)}
          />
          <div className="border-t border-gray-100" />
          
          {mlConnected ? (
            <>
              <div className="p-4 bg-green-50 border-b border-green-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">Conta Conectada</p>
                    <p className="text-xs text-green-600">{mlNickname || 'Sincronização ativa'}</p>
                  </div>
                </div>
              </div>
              <SettingItem
                icon={<Package className="w-5 h-5 text-blue-600" />}
                title="Importar Anúncios"
                description="Trazer produtos do Mercado Livre"
                onClick={() => {
                  setShowMLModal(true);
                  loadMLItems();
                }}
              />
              <div className="border-t border-gray-100" />
              <SettingItem
                icon={<Link2Off className="w-5 h-5 text-red-500" />}
                title="Desconectar Conta"
                description="Remover integração com ML"
                onClick={handleDisconnectML}
              />
            </>
          ) : (
            <SettingItem
              icon={<Link2 className="w-5 h-5 text-green-600" />}
              title="Conectar Conta"
              description="Sincronizar vendas automaticamente"
              onClick={handleConnectML}
            />
          )}
        </Card>

        {/* Notificações */}
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Notificações
            </h3>
          </div>
          <SettingItem
            icon={<Bell className="w-5 h-5 text-purple-600" />}
            title="Alertas de Vendas"
            description="Receber notificações ao vender"
            rightElement={
              <SwitchPrimitive.Root
                checked={notificacoesAtivas}
                onCheckedChange={toggleNotificacoes}
                className={cn(
                  'w-11 h-6 rounded-full transition-colors',
                  notificacoesAtivas ? 'bg-primary-600' : 'bg-gray-200'
                )}
              >
                <SwitchPrimitive.Thumb
                  className={cn(
                    'block w-5 h-5 bg-white rounded-full shadow-sm transition-transform',
                    notificacoesAtivas ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </SwitchPrimitive.Root>
            }
          />
        </Card>

        {/* Conta */}
        <Card className="overflow-hidden p-0">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              Conta
            </h3>
          </div>
          <SettingItem
            icon={<User className="w-5 h-5 text-gray-600" />}
            title="Minha Conta"
            description={userEmail || 'Gerenciar perfil'}
            onClick={() => setShowContaModal(true)}
          />
          <div className="border-t border-gray-100" />
          <SettingItem
            icon={<Info className="w-5 h-5 text-gray-600" />}
            title="Sobre o App"
            description="LLControl v1.0.0"
          />
          <div className="border-t border-gray-100" />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 text-left text-danger-600 active:bg-danger-50 transition-colors"
          >
            <div className="p-2 bg-danger-100 rounded-xl">
              <LogOut className="w-5 h-5 text-danger-600" />
            </div>
            <span className="font-medium">Sair da Conta</span>
          </button>
        </Card>
      </div>

      {/* Metas Modal */}
      <Modal
        open={showMetasModal}
        onOpenChange={setShowMetasModal}
        title="Metas de Lucro"
        description="Defina suas metas para acompanhar seu progresso"
      >
        <div className="space-y-4">
          <Input
            label="Meta Diária (R$)"
            type="number"
            placeholder="0,00"
            step="0.01"
            value={metaDiaria}
            onChange={(e) => setMetaDiaria(e.target.value)}
          />
          <Input
            label="Meta Mensal (R$)"
            type="number"
            placeholder="0,00"
            step="0.01"
            value={metaMensal}
            onChange={(e) => setMetaMensal(e.target.value)}
          />
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowMetasModal(false)}
            >
              Cancelar
            </Button>
            <Button fullWidth onClick={salvarMetas}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Taxas Modal */}
      <Modal
        open={showTaxasModal}
        onOpenChange={setShowTaxasModal}
        title="Taxas do Mercado Livre"
        description="Personalize as taxas conforme seu contrato"
      >
        <div className="space-y-4">
          <Input
            label="Taxa Clássico (%)"
            type="number"
            placeholder="11"
            step="0.1"
            value={taxaClassico}
            onChange={(e) => setTaxaClassico(e.target.value)}
          />
          <Input
            label="Taxa Premium (%)"
            type="number"
            placeholder="16"
            step="0.1"
            value={taxaPremium}
            onChange={(e) => setTaxaPremium(e.target.value)}
          />
          <div className="p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
            <p>Valores padrão: Clássico 11% • Premium 16%</p>
            <p className="mt-1">Taxa fixa de R$ 6,00 em vendas abaixo de R$ 79,00</p>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowTaxasModal(false)}
            >
              Cancelar
            </Button>
            <Button fullWidth onClick={salvarTaxas}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Conta Modal */}
      <Modal
        open={showContaModal}
        onOpenChange={setShowContaModal}
        title="Minha Conta"
        description="Informações da sua conta"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <User className="w-6 h-6 text-primary-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900">{userEmail}</p>
            </div>
          </div>
          
          <div className="border-t pt-4">
            <button
              onClick={() => {
                setShowContaModal(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-danger-50 text-danger-600 rounded-xl font-medium active:bg-danger-100 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sair da Conta
            </button>
          </div>

          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowContaModal(false)}
          >
            Fechar
          </Button>
        </div>
      </Modal>

      {/* Modal Importar ML */}
      <Modal
        open={showMLModal}
        onOpenChange={setShowMLModal}
        title="Importar do Mercado Livre"
        description="Selecione os anúncios para importar ao estoque"
      >
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
          ) : mlItems.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhum anúncio encontrado</p>
              <button
                onClick={loadMLItems}
                className="mt-3 text-primary-600 text-sm font-medium flex items-center gap-1 mx-auto"
              >
                <RefreshCw className="w-4 h-4" /> Recarregar
              </button>
            </div>
          ) : (
            mlItems.map((item) => (
              <div 
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                  item.imported 
                    ? "bg-green-50 border-green-200" 
                    : "bg-gray-50 border-gray-200"
                )}
              >
                {item.thumbnail && (
                  <img 
                    src={item.thumbnail.replace('http://', 'https://')} 
                    alt={item.title}
                    className="w-14 h-14 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatarMoeda(item.price)} • Estoque: {item.available_quantity}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.status === 'active' ? '🟢 Ativo' : '🔴 ' + item.status}
                  </p>
                </div>
                {item.imported ? (
                  <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                    <Check className="w-4 h-4" /> Importado
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => importarProdutoML(item)}
                    disabled={importingItem === item.id}
                  >
                    {importingItem === item.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      'Importar'
                    )}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        
        <div className="flex gap-3 pt-4 border-t mt-4">
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setShowMLModal(false)}
          >
            Fechar
          </Button>
          <Button
            fullWidth
            onClick={loadMLItems}
            disabled={loadingItems}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", loadingItems && "animate-spin")} />
            Atualizar Lista
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    }>
      <AjustesContent />
    </Suspense>
  );
}
