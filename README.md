# LLControl

Gestão de Estoque e Vendas integrado com Mercado Livre.

## 🚀 Stack Tecnológica

- **Framework:** Next.js 14+ (App Router)
- **Estilização:** Tailwind CSS + Framer Motion
- **Backend/Banco:** Supabase (Auth, PostgreSQL, Storage)
- **PWA:** next-pwa
- **Iconografia:** Lucide React
- **Componentes:** Radix UI

## 📱 Funcionalidades

- ✅ Dashboard com visões Diária/Semanal/Mensal
- ✅ Gestão de Estoque com upload de fotos
- ✅ Cálculo automático de taxas do Mercado Livre
- ✅ Registro de vendas manuais com swipe-to-action
- ✅ Histórico de vendas agrupado por data
- ✅ Configurações de taxas e metas
- ✅ PWA com suporte offline
- ✅ Webhook para integração com Mercado Livre

## 🛠️ Instalação

### 1. Clone e instale as dependências

```bash
cd llcontrol
npm install
```

### 2. Configure o Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. Execute o schema SQL em `supabase/schema.sql`
3. Crie um bucket chamado `produtos` no Storage (público)
4. Copie as credenciais para o arquivo `.env.local`

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Edite o `.env.local` com suas credenciais:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

### 4. Rode o projeto

```bash
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 📂 Estrutura do Projeto

```
llcontrol/
├── public/
│   ├── manifest.json       # PWA manifest
│   └── icons/              # Ícones do app
├── src/
│   ├── app/
│   │   ├── (app)/          # Rotas com Tab Bar
│   │   │   ├── dashboard/  # Dashboard analítico
│   │   │   ├── estoque/    # Gestão de inventário
│   │   │   ├── vendas/     # Histórico de vendas
│   │   │   └── ajustes/    # Configurações
│   │   ├── api/
│   │   │   └── ml-webhook/ # Webhook Mercado Livre
│   │   ├── layout.tsx      # Layout raiz
│   │   └── globals.css     # Estilos globais
│   ├── components/
│   │   ├── navigation/     # Tab Bar
│   │   └── ui/             # Componentes reutilizáveis
│   ├── lib/
│   │   ├── supabase/       # Cliente Supabase
│   │   └── utils/          # Funções utilitárias
│   └── types/              # Tipos TypeScript
├── supabase/
│   └── schema.sql          # Schema do banco
└── package.json
```

## 💰 Cálculo de Taxas

O app calcula automaticamente:

- **Taxa Clássico:** 11% (configurável)
- **Taxa Premium:** 16% (configurável)
- **Taxa Fixa:** R$ 6,00 em vendas < R$ 79,00

**Fórmula do Lucro:**
```
Lucro = Valor Venda - Custo - (Valor × Taxa%) - Taxa Fixa
```

## 🔗 Integração Mercado Livre

1. Crie um app em [Mercado Livre Developers](https://developers.mercadolibre.com)
2. Configure o webhook: `https://seu-dominio.vercel.app/api/ml-webhook`
3. Conecte sua conta na página de Ajustes

O app escuta eventos de `orders` e atualiza automaticamente:
- Estoque do produto
- Registro de venda
- Cálculo de lucro

## 🎨 Design iOS-Native

- Tab Bar inferior com glassmorphism
- Transições suaves com Framer Motion
- Swipe-to-action para ações rápidas
- Feedback háptico simulado
- Safe area para notch do iPhone
- Modais slide-up

## 📦 Deploy na Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/seu-usuario/llcontrol)

1. Conecte seu repositório
2. Configure as variáveis de ambiente
3. Deploy automático!

## 📄 Licença

MIT
