# ProspectAI — Auditoria de Segurança + Revisão Estratégica

> Revisão end-to-end de segurança e estratégia. Achados de segurança verificados diretamente no código-fonte (`supabase/migrations/` + `supabase/functions/`) e no histórico git. RLS confirmado em source — o token MCP Lovable conectado aponta para outro projeto, então confirme também na DB de produção (`nqnavnodguhpmjhpsddo`) antes de fechar.

---

## 🔴 P0 — Crítico (agir hoje)

### S1. Chaves de API reais commitadas no `.mcp.json` (e no histórico git)
- **Local:** `.mcp.json` (rastreado pelo git, presente no commit inicial).
- **Exposto:** `APOLLO_API_KEY="MsbZGZ13h8p0K6DldPSp2Q"`, `PDL_API_KEY="6a6f322a…1998"`.
- **Impacto:** qualquer um com acesso ao repo usa suas cotas pagas Apollo/PDL (custo direto) e seus dados.
- **Fix:**
  1. **Rotacionar AGORA** as duas chaves nos painéis Apollo e People Data Labs.
  2. Remover do índice: `git rm --cached .mcp.json .env` e adicionar ambos ao `.gitignore`.
  3. Purgar do histórico (`git filter-repo --invert-paths --path .mcp.json` ou BFG) e force-push.
  4. `.mcp.json` deve referenciar segredos via env do shell, nunca literais.

### S2. Edge functions rodam como `service_role` sem autorização do chamador
- **Local:** `whatsapp-send`, `email-send`, `lead-search-execute`, `contact-enrich`, `generate-opener`, `facebook-discovery`, `evolution-setup` — todas fazem `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` na entrada e **nunca** chamam `auth.getUser()` nem checam role.
- **Por que `verify_jwt` não salva:** a `anon key` é pública (vai no bundle e no `.env`). Se `verify_jwt=false`, não precisa de token; se `verify_jwt=true`, a própria anon key passa na validação. Em nenhum caso há autorização real por usuário.
- **Exploit:**
  ```bash
  curl -X POST https://nqnavnodguhpmjhpsddo.supabase.co/functions/v1/whatsapp-send \
    -H "Authorization: Bearer <ANON_KEY_PÚBLICA>" -H "content-type: application/json" \
    -d '{"action":"send_single","contacts":[{"phone":"5511...","text":"spam"}]}'
  ```
  Qualquer um na internet: dispara WhatsApp/e-mail pelo seu número/domínio (risco de ban + custo Resend), e roda `lead-search-execute`/`contact-enrich` queimando créditos Apollo/Apify/PDL/LLM.
- **Fix:** no topo de cada função, validar o JWT do usuário com um client `anon` (`createClient(URL, ANON, {global:{headers:{Authorization:req.headers.get('authorization')}}})` → `auth.getUser()`), rejeitar se ausente, e checar role via `has_role` quando a ação for sensível. Só depois subir para `service_role` para a operação. Manter `verify_jwt=true` em todas exceto webhooks/health-check.

### S3. Webhooks sem verificação de assinatura
- **Local:** `apollo-phone-webhook/index.ts`, `evolution-webhook/index.ts` — aceitam `req.json()` e escrevem em `contacts`/`outreach_messages` como `service_role`, sem validar origem.
- **Exploit:** `POST` forjado injeta telefone/mensagem em qualquer contato → envenenamento de CRM e da inbox.
- **Fix:** validar assinatura/segredo compartilhado. Evolution suporta header de token; Apollo — usar um path com token secreto (`/apollo-phone-webhook?t=<segredo>`) comparado em tempo constante. Rejeitar payloads sem assinatura válida.

### S4. RLS permissiva (`USING (true) WITH CHECK (true)`) em tabelas de PII
- **Local:** `20260316160326_*.sql` (`contacts`, `contact_lists`, `lead_searches`, `scraping_jobs`), `20260412*_settings*.sql` (`settings`), `20260413*_*.sql` (`outreach_messages`). Nunca endurecidas depois.
- **Impacto:** policies são role-agnósticas (valem para `anon` e `authenticated`). Com os GRANTs padrão do Lovable, qualquer um com a anon key lê/escreve **todos** os leads (nome, telefone, e-mail, gênero), mensagens e a config Evolution direto via PostgREST:
  ```bash
  curl "https://nqnavnodguhpmjhpsddo.supabase.co/rest/v1/contacts?select=name,phone,email" \
    -H "apikey: <ANON_KEY>"
  ```
- **Fix:** como é single-tenant, restringir as policies a usuários autenticados: `FOR ALL TO authenticated USING (auth.uid() IS NOT NULL)` no mínimo; idealmente escopar por `owner_id`/role. Remover GRANT de `anon` nessas tabelas. Confirmar o estado real em produção.

---

## 🟠 P1 — Alto

| # | Achado | Local | Fix |
|---|--------|-------|-----|
| S5 | `.env` versionado (anon key + project id) — públicos por design, mas má higiene | `.env` rastreado | `git rm --cached .env`, gitignorar |
| S6 | CORS `Access-Control-Allow-Origin: "*"` em todas as functions | todas | Restringir à origem da app |
| S7 | Modelo de roles (`user_roles`, `app_role`, `has_role`, `handle_new_user`, "1º user = admin") **não está em nenhuma migration do repo** | base Lovable | Não auditável aqui. Confirmar em produção que (a) o 1º signup vira admin e (b) signup público não permite auto-promoção a admin |
| B1 | **Contrato quebrado IA↔executor**: `lead-search-ai-chat` oferece 17 fontes ao LLM; `lead-search-execute` implementa ~9 (só 4 coincidem). Source não implementado → busca conclui com 0 contatos sem erro. Quebra o caminho de ativação ("Busca Rápida IA"). | `lead-search-ai-chat:97` vs `lead-search-execute:111` | Unificar o enum de sources; teste de contrato |
| B2 | Botão "Finalizar Setup" travado quando Apollo já configurado por outro admin | `OnboardingPage.tsx:427` | `disabled={isSaving || (!apolloKey.trim() && !apiKeys?.apollo?.configured)}` |
| L1 | **LGPD/compliance**: prospecção fria de PF por WhatsApp/e-mail sem base legal, opt-out, registro de consentimento ou supressão | modelo de negócio | Tabela `suppressions` + checagem antes de cada envio + link de descadastro no e-mail. Parecer jurídico antes de monetizar |

---

## 🟡 P2 — Médio

| # | Achado | Local | Fix |
|---|--------|-------|-----|
| B3 | "Gerar Openers" bloqueado por `!evoConnected` mesmo no canal e-mail | `AbordagemPage.tsx:368` | `(channel === "whatsapp" && !evoConnected)` |
| B4 | SQL injection-ish no PDL: free-text interpolado em SQL string (`job_title='${p}'`) — apóstrofo quebra a query | `lead-search-execute.ts:317` | escapar `'` → `''` |
| B5 | Filtro de busca interpola termo cru em `.or("name.ilike.%${search}%")` — `,`/`%` quebram o parser | `useContacts.ts:19`, `useContactsByList.ts:26` | sanitizar ou usar `.ilike()` separados |
| B6 | Match de inbound por últimos 8 dígitos pode atribuir conversa ao contato errado | `evolution-webhook.ts:50` | casar telefone normalizado completo |
| Q1 | **Duas** normalizações de telefone BR divergentes — número salvo pode não bater no envio | `lead-search-execute.ts:28` vs `whatsapp-send.ts:334` | extrair `_shared/phone.ts` único com testes |
| Q2 | Cobertura de testes ~0% (só `example.test.ts`) | `src/test/` | testes em normalização de telefone, merge de contatos, contrato de sources |
| Q3 | `invalidateQueries({queryKey:["lead_searches","contact_lists"]})` trata como UMA chave composta | `SearchChat.tsx:128` | invalidar cada chave separadamente |

---

## 🟢 Estratégia de produto

1. **Cortar escopo (overbuilt).** 3 inventários de fontes que não conversam (builder=9, IA=17, executor=9). `SearchPage` tem 10 seções de filtro; o executor ignora `education`, `company_size`, `years_experience`, `age_range` — promessa quebrada. **Reduzir a 3-4 fontes que funcionem ponta a ponta** (Apollo + Google Maps + Tavily cobrem ~80% do B2C BR) e cortar/implementar os filtros.
2. **Fechar o activation gap.** Onboarding exige Apollo (paga) + Evolution (servidor WhatsApp self-hosted) antes de qualquer valor. Oferecer um "modo avaliação" só com Tavily (web pública) para o usuário ver 1 lista de leads antes de pagar.
3. **Single-tenant é teto de negócio.** Sem coluna de tenant nem billing/metering. Chamadas Apollo/Apify/PDL geram custo por lead sem contador — decisão consciente de produto se for virar SaaS multi-tenant (exige rebuild de schema + RLS).
4. **Refatorar `lead-search-execute` (415 linhas)** em `sources/*.ts` com interface comum — **depois** de cortar as fontes mortas.

---

## ✅ O que está bem feito
- **Vault**: RPCs `set/delete/list_project_secret` são admin-only; `get_vault_key` revogado de `anon`/`authenticated`, só `service_role`. Nenhum segredo de runtime em env/settings. Modelo sólido.
- Validação server-side das API keys antes de gravar no Vault.
- `api_keys_registry` com RLS admin-only correta.

---

## Plano de ação sugerido (ordem)
1. **Hoje:** rotacionar Apollo+PDL, purgar `.mcp.json`/`.env` do git (S1, S5).
2. **Esta semana:** autorização nas edge functions + assinatura nos webhooks + endurecer RLS (S2, S3, S4) — confirmando contra a DB de produção.
3. **Sprint:** corrigir contrato IA↔executor (B1) + bloqueadores de onboarding (B2/S7) + supressão LGPD (L1).
4. **Depois:** unificar telefone (Q1) + testes (Q2) + corte de escopo de fontes/filtros.
