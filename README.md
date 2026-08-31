# ProspectAI

Dashboard de prospecção B2C com IA — busca, enriquece e contata leads (Pessoas Físicas) via WhatsApp e e-mail.

Stack: React 18 + Vite + TypeScript + Tailwind + shadcn/ui · Supabase (Postgres + Edge Functions Deno + Vault) · Lovable AI Gateway.

---

## 🚀 Setup pós-remix (5 minutos)

Quando você **remixa** este projeto, um novo backend Lovable Cloud (Supabase) é provisionado automaticamente. Migrations rodam sozinhas, mas as **API keys ficam zeradas** (Vault é por projeto, não copia). Siga os passos:

### 1. Crie sua conta admin

Abra a app remixada → tela `/auth` → clique em **Cadastrar**.

> O **primeiro usuário** que se cadastra é automaticamente promovido a `admin` (lógica em `handle_new_user()` trigger). Os próximos serão `agent` por padrão.

### 2. Complete o wizard `/setup`

Ao logar pela primeira vez, você é redirecionado para `/setup`. **Apenas a chave Apollo é obrigatória** — ela define `workspace_ready=true` e libera o app para todos os usuários.

| Serviço | Onde obter | Obrigatório? |
|---|---|---|
| **Apollo** | https://app.apollo.io → Settings → Integrations → API | ✅ Sim |
| Apify (Instagram) | https://console.apify.com → Settings → Integrations | Opcional |
| CrustData | https://crustdata.com → Dashboard → API Keys | Opcional |
| Tavily (web search) | https://tavily.com → Dashboard | Opcional |
| PDL (People Data Labs) | https://dashboard.peopledatalabs.com | Opcional |
| Evolution (WhatsApp) | URL + key da sua instância self-hosted | Opcional |
| Resend (email) | https://resend.com/api-keys | Opcional |

Cada chave é **validada server-side antes de ser gravada no Vault**. Inválida = não persiste, com mensagem do provedor.

### 3. Health check (opcional)

Visite `/settings` → role até **"Status do workspace"** para ver:
- ✅ Migrations aplicadas
- ✅ RLS policies ativas
- ✅ Edge functions deployadas
- ✅ Apollo configurada (workspace_ready)
- 🟡/🔴 Demais integrações (informativo)

Ou chame direto a edge function: `GET /functions/v1/remix-health-check`.

### 4. Pronto

Você é redirecionado para `/` (Dashboard). Crie uma lista, vá em **Buscar** e dispare a primeira prospecção.

---

## 🧠 Arquitetura essencial

- **Vault-only secrets**: nenhuma API key vive em variável de ambiente Deno ou na tabela `settings`. Tudo passa por `api_keys_registry` + `vault.secrets`.
- **Onboarding per-user**: `user_onboarding (user_id PK)` controla quem já viu o wizard. `is_workspace_ready()` consulta presença real do Apollo no Vault.
- **Roles**: `admin` / `supervisor` / `agent` em `user_roles`. Admins gerenciam Vault. Agents em workspace não-pronto veem `<WaitingForAdminSetup />`.
- **B2C-only**: filtros agressivos rejeitam empresas/marcas em todas as fontes (`mem://constraints/b2c-filtering`).
- **Phone format BR**: `55` + DDD + `9` + 8 dígitos, validado em todo pipeline (`mem://constraints/phone-formatting-brazil`).

Memória completa do projeto: `.lovable/memory/index.md`.

---

## 🛠 Desenvolvimento local

```sh
npm i
npm run dev
```

`.env` é gerenciado pelo Lovable (contém `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`). Não edite manualmente.

Edge functions deployam automaticamente ao salvar — não precisa `supabase functions deploy`.

---

## 📦 Tecnologias

Vite · TypeScript · React · Tailwind · shadcn/ui · TanStack Query · React Router · Supabase JS · Lovable AI Gateway.
