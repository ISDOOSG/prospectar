# Edge Functions

**MEDIDO** em 2026-08-31: 15 funções em `supabase/functions/`, mais um módulo
compartilhado `_shared/cron-auth.ts`. Todas rodam em Deno.

`config.toml` tem **apenas** `project_id`. Não há bloco `[functions]`, ou seja
nenhuma declara `verify_jwt` explicitamente.

---

## Quadro geral

| Função | Linhas | Ações | Chave que usa | Gasta dinheiro? | Exige autenticação? |
|---|---|---|---|---|---|
| `api-keys-list` | 74 | — | anon + JWT do usuário | não | **SIM, admin** |
| `api-keys-save` | 182 | — | anon + JWT do usuário | valida contra 6 APIs | **SIM, admin** |
| `api-keys-delete` | 50 | — | anon + JWT do usuário | não | **SIM, admin** |
| `app-config` | 147 | get, save, get_onboarding_state, mark_user_onboarded, reset_user_onboarding | anon + service_role | não | **SIM** |
| `whatsapp-send` | 380 | send_single, send_bulk, resolve_contacts | service_role + Vault `evolution` | **envia WhatsApp** | 🔴 **NÃO** |
| `email-send` | 177 | send_single, send_bulk | service_role + Vault `resend` | **envia e-mail** | 🔴 **NÃO** |
| `lead-search-execute` | 473 | — | service_role | **queima crédito de 5 APIs** | 🔴 **NÃO** |
| `contact-enrich` | 299 | — | service_role | **Apify, PDL, Tavily** | 🔴 **NÃO** |
| `facebook-discovery` | 398 | — | service_role + Vault `apify`, `tavily` | **Apify, Tavily** | 🔴 **NÃO** |
| `evolution-setup` | 188 | setup, status, qrcode, test, disconnect | service_role + Vault `evolution` | não | 🔴 **NÃO** |
| `generate-opener` | 117 | — | `LOVABLE_API_KEY` | **crédito de IA** | 🔴 **NÃO** |
| `lead-search-ai-chat` | 183 | — | `LOVABLE_API_KEY` | **crédito de IA** | 🔴 **NÃO** |
| `apollo-phone-webhook` | 74 | — | service_role | não | 🔴 **NÃO, e é webhook** |
| `evolution-webhook` | 132 | — | service_role | não | 🔴 **NÃO, e é webhook** |
| `remix-health-check` | 128 | — | service_role | não | público **de propósito** |

🚨 **Onze das quinze não verificam quem chama.** Detalhe em
`03_Acesso_e_Papeis.md` — aqui fica só o mapa do que cada uma faz.

---

## As que gastam ou enviam

### `lead-search-execute` — 473 linhas, a maior

O motor da busca. Fala com **Apollo** (`people/bulk_match`, em lotes de 10),
**Apify** (Twitter/X, TikTok, Instagram), **Tavily** (busca web), **PDL** e
**CrustData**. Deposita tudo em `contacts`, com `_source` marcando a origem, e
grava o relatório em `lead_searches.source_reports`.

Tetos MEDIDOS no código, todos fixos, nenhum configurável:

| Onde | Teto |
|---|---|
| Apollo `bulk_match` | lotes de **10** ids |
| busca por profissão | primeiras **3** combinações |
| consultas Tavily | primeiras **2** |
| bio guardada | **500** caracteres |
| tweet guardado | **300** caracteres |
| telefones e e-mails por contato | **5** |
| skills e interesses | **10** |

⚠️ Há também uma **regra de telefone brasileiro** na linha 34: número com 10
dígitos cujo primeiro dígito do número seja >= 6 recebe um `9` na frente. É
correção de celular antigo, e é decisão de negócio escondida em uma linha.

### `contact-enrich` — 299 linhas

Enriquece um contato existente com Apify, PDL e Tavily.

### `facebook-discovery` — 398 linhas

Descobre leads em grupos do Facebook via Apify e Tavily. Tetos: **5** grupos
únicos, **10** resultados, 500 caracteres de descrição, 300 de comentário.

### `whatsapp-send` — 380 linhas

Envia por WhatsApp usando a **Evolution self-hosted**. Lê `evolution_api_url`,
`evolution_instance_name` e `evolution_connected` de `settings`, e a chave do
**Vault** (`get_vault_key("evolution")`).

Duas guardas de estado, MEDIDAS:
1. sem `evolution_api_url` ou sem chave → 400 *"Evolution API não configurada"*
2. com `evolution_connected = false` → 400 *"WhatsApp não está conectado"*

⚠️ Instância padrão quando `evolution_instance_name` é nulo: **`prospecta-ai`**.

### `email-send` — 177 linhas

Envia por **Resend**, com a chave do Vault. Usa `resend_from_email` e
`resend_from_name` de `settings`.

### `generate-opener` e `lead-search-ai-chat`

Falam com o **Lovable AI Gateway** (`ai.gateway.lovable.dev`) usando
`LOVABLE_API_KEY` do ambiente. São as únicas que não tocam o banco.

---

## As de configuração

### `api-keys-save` — a que valida antes de guardar

Testa a chave contra o provedor **antes** de gravar no Vault: Apollo, Apify,
CrustData, PDL, Tavily e Resend têm chamada de validação. Isso é bom desenho —
chave errada não entra e depois falha silenciosamente em produção.

### `evolution-setup` — 188 linhas

Cinco ações: `setup`, `status`, `qrcode`, `test`, `disconnect`. É por onde a
instância do WhatsApp é criada e pareada.

### `app-config`

Só campos **não secretos**, e a lista é fechada em código
(`ALLOWED_FIELDS`, 11 campos). Chave de API não passa por aqui — é explícito no
comentário de topo.

---

## Os webhooks

### `evolution-webhook` — 132 linhas

Recebe eventos da Evolution e escreve em `contacts` e `outreach_messages` como
`service_role`.

### `apollo-phone-webhook` — 74 linhas

Recebe telefone revelado pelo Apollo e atualiza `contacts`.

🚨 **Nenhum dos dois valida origem.** MEDIDO por busca por
`signature|hmac|secret|token|verify`: zero ocorrências em ambos. E MEDIDO de
fora: `POST` vazio sem credencial no `evolution-webhook` devolveu
`200 {"received":true}`.

---

## O módulo que ninguém usa

`_shared/cron-auth.ts` implementa autenticação de cron **corretamente**:
`Bearer` obrigatório, comparação por `timingSafeEqual` sobre SHA-256, e suporte
a segredo anterior para rotação sem queda (`LOVABLE_CRON_SECRET` e
`LOVABLE_CRON_SECRET_PREVIOUS`).

🚨 **MEDIDO: nenhuma função o importa.** É o padrão certo, já escrito, parado.
Serve de molde para consertar os dois webhooks.

---

## CORS

**Todas as 15** respondem `Access-Control-Allow-Origin: *`. Para as que exigem
JWT isso é aceitável. Para as onze que não exigem, significa que qualquer
página de qualquer domínio chama direto do navegador.
