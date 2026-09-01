# Arquitetura — as 15 funções e o que cada uma vira na VPS

**MEDIDO** em 2026-08-31: 15 Edge Functions em Deno, mais `_shared/cron-auth.ts`
(nunca importado). Todas rodam como serviço único na VPS, então o problema que
motivava a Edge Function em separado — escalar isoladamente — deixa de existir.
Isso simplifica a migração: as 15 podem virar **rotas de um único serviço**
(padrão dos outros projetos da VPS: `movizap_painel`, `fpsl_weso` etc.), não
15 processos.

---

## Quadro geral, com destino na VPS

| Função | Ações | Gasta dinheiro? | Autenticava no Supabase? | Destino sugerido |
|---|---|---|---|---|
| `api-keys-list` | — | não | **admin, via `list_project_secrets`** | rota admin, mesma trava |
| `api-keys-save` | — | valida contra 6 APIs | **admin** | rota admin |
| `api-keys-delete` | — | não | **admin** | rota admin |
| `app-config` | get, save, onboarding | não | **JWT do usuário** | rota autenticada |
| `whatsapp-send` | send_single, send_bulk, resolve_contacts | **envia WhatsApp** | 🔴 não | rota autenticada — **corrigir ao migrar** |
| `email-send` | send_single, send_bulk | **envia e-mail** | 🔴 não | idem |
| `lead-search-execute` | — | **queima 5 APIs pagas** | 🔴 não | idem |
| `contact-enrich` | — | Apify, PDL, Tavily | 🔴 não | idem |
| `facebook-discovery` | — | Apify, Tavily | 🔴 não | idem |
| `evolution-setup` | setup, status, qrcode, test, disconnect | não | 🔴 não | idem |
| `generate-opener` | — | crédito de IA (Lovable Gateway) | 🔴 não | **trocar de provedor de IA** — Lovable Gateway não migra |
| `lead-search-ai-chat` | — | crédito de IA | 🔴 não | idem |
| `apollo-phone-webhook` | — | não | 🔴 não, e é webhook | endpoint público — **assinar** |
| `evolution-webhook` | — | não | 🔴 não, e é webhook | idem — é a mesma Evolution que o MoviZap já usa na VPS |
| `remix-health-check` | — | não | público de propósito | **não migra** — é diagnóstico de remix Lovable, sem sentido fora dele |

🚨 **11 das 15 não verificavam quem chamava.** Ver `04_Acesso_e_Seguranca.md`
para o detalhe e a correção.

---

## O que precisa de decisão de provedor, não só de código

### IA: `generate-opener` e `lead-search-ai-chat`

Usam `LOVABLE_API_KEY` contra `ai.gateway.lovable.dev` — **infraestrutura do
Lovable, não migra**. Precisa de um provedor próprio (OpenAI, Anthropic,
DeepSeek — o MoviChat já usa DeepSeek na VPS, pode reaproveitar chave e
padrão).

### WhatsApp: `whatsapp-send`, `evolution-setup`, `evolution-webhook`

Já usam **Evolution self-hosted** — a mesma tecnologia que o MoviZap roda na
VPS. Ler `settings.evolution_api_url` continua fazendo sentido; o que muda é
de onde a chave vem (Vault → `.env`, ver `04_Acesso_e_Seguranca.md`).

### E-mail: `email-send`

Usa Resend. Mantém-se se a chave migrar; senão, trocar de provedor.

---

## A que faz mais coisa: `lead-search-execute` (473 linhas)

O motor da busca. Fala com **Apollo** (`bulk_match`, lotes de 10), **Apify**
(Twitter/X, TikTok, Instagram), **Tavily**, **PDL** e **CrustData**. Grava em
`contacts` com `_source`, e o relatório em `lead_searches.source_reports`.

Tetos fixos no código, nenhum configurável — **migram junto, sem mudança**:

| Onde | Teto |
|---|---|
| Apollo `bulk_match` | lotes de **10** |
| busca por profissão | primeiras **3** combinações |
| consultas Tavily | primeiras **2** |
| bio / tweet guardados | 500 / 300 caracteres |
| telefones e e-mails por contato | **5** |
| skills e interesses | **10** |

⚠️ **Regra de telefone brasileiro embutida:** número de 10 dígitos cujo
primeiro dígito seja ≥ 6 recebe um `9` na frente. Decisão de negócio numa
linha, sem teste, sem documento — **preservar exatamente** ao portar, é fácil
de perder numa reescrita.

## `contact-enrich`, `facebook-discovery`

Mesma classe de função — chamam APIs pagas de terceiros, gravam em `contacts`.
`facebook-discovery`: tetos de 5 grupos, 10 resultados, 500/300 caracteres.

## Os dois webhooks

`apollo-phone-webhook` e `evolution-webhook` não validam origem — **nenhuma**
assinatura, nenhum segredo compartilhado. `evolution-webhook` é o mais urgente
de assinar porque é o mesmo padrão que a VPS já usa para o MoviZap (segredo no
caminho da URL, ver `movisat-operacao/docs/04_`) — dá para copiar a solução
que já existe em vez de inventar uma nova.

## O módulo nunca usado

`_shared/cron-auth.ts` — autenticação de cron correta, com `timingSafeEqual`
e suporte a segredo anterior. Ninguém a importa. Serve de molde para os
webhooks acima.
