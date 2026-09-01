# Acesso e papéis — quem pode o quê

**MEDIDO** em 2026-08-31, contra o código e contra o projeto
`wsqbwljeuwzderdrjeve` rodando.

---

## As três camadas, e só uma protege

### Camada 1 — a trava real: papel imposto dentro do Postgres

Quatro funções fazem certo. Elas exigem `Authorization: Bearer`, criam o client
com a **anon key mais o header do usuário** (para o RLS enxergar quem é), e
delegam a autorização ao banco.

```
api-keys-list · api-keys-save · api-keys-delete · app-config
```

MEDIDO de fora:

```
POST /functions/v1/api-keys-list   sem chave        -> 401
POST /functions/v1/api-keys-list   com a anon key   -> 403
     {"error":"Apenas administradores podem listar chaves do projeto"}
POST /functions/v1/app-config      sem chave        -> 401
POST /functions/v1/app-config      com a anon key   -> 401
```

🚨 **O `api-keys-list` não checa papel em TypeScript.** Ele chama o RPC
`list_project_secrets`, que **levanta exceção no Postgres** se quem chama não
for admin, e a função apenas converte isso em 403. É o desenho correto: a trava
não morre se alguém reescrever a borda.

O `app-config` usa `supabase.auth.getClaims()` e exige `sub` no token.

⚠️ Nota de método: uma varredura por `auth.getUser` diz que **nenhuma** função
autentica. É falso. Elas usam `getClaims()` e RPC com papel no banco. Medir o
nome da função em vez do comportamento erra aqui.

### Camada 2 — sem trava nenhuma: onze funções

```
whatsapp-send · email-send · lead-search-execute · contact-enrich
facebook-discovery · evolution-setup · generate-opener
lead-search-ai-chat · apollo-phone-webhook · evolution-webhook
remix-health-check (público de propósito)
```

Todas abrem com `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` na primeira
linha do handler e **nunca perguntam quem chamou**.

🔴 **PROVADO, e é o achado mais grave:**

```
POST /functions/v1/whatsapp-send   SEM Authorization, SEM apikey
-> HTTP 400 {"error":"Evolution API não configurada."}
```

Não veio 401. Veio a mensagem de dentro do código — a requisição atravessou a
plataforma e **executou o handler**. O único motivo de nada ter sido enviado é
que a Evolution ainda não está configurada.

**No dia em que a Evolution for conectada, essa mesma chamada envia WhatsApp
pelo número da empresa.** O mesmo vale para `email-send` com o Resend, e para
as três funções que queimam crédito de Apollo, Apify, PDL, Tavily e CrustData.

⚠️ Não adianta ligar `verify_jwt`: a anon key é **pública por desenho** — vai
no bundle do navegador e está no `.env` versionado. Ela passa em qualquer
validação de JWT. A autorização precisa ser **por usuário**, não por chave.

### Camada 3 — o frontend, que é cosmético

MEDIDO em `src/`:

| Guarda | Onde | O que faz |
|---|---|---|
| `RequireAuth` | `App.tsx:31` | sem sessão → `/auth` |
| portão do setup | `App.tsx:58-59` | sem onboarding → `/setup`; com → sai de lá |
| `isAdmin` | `SettingsPage.tsx:208`, `useSettings.ts:143` | **só esconde cartões na tela** |

Isso protege navegação, não API. Quem chama a função direto não passa por nada
disso.

---

## Papéis

```
app_role = admin | supervisor | agent
```

| Papel | Como se ganha | O que muda |
|---|---|---|
| `admin` | **primeiro usuário** que se cadastra, por trigger `handle_new_user` | gerencia chaves do projeto; vê o cartão de saúde |
| `agent` | todos os seguintes, por padrão | uso normal |
| `supervisor` | **DESCONHECIDO** | ⚠️ existe no enum e **não é usado em lugar nenhum** |

⚠️ **`profiles.is_approved` é NOT NULL e não achei uso no frontend.** Ou é um
portão de aprovação que ninguém ligou, ou é herança do projeto original.
DESCONHECIDO qual dos dois.

---

## RLS — o que consegui provar e o que não

MEDIDO: as 8 tabelas consultadas com a **anon key** responderam **HTTP 200**,
não "permission denied".

```
contacts · settings · outreach_messages · lead_searches
contact_lists · user_onboarding · user_roles · api_keys_registry
```

**O que isso prova:** o papel `anon` **tem GRANT de SELECT** em todas as oito.
Se não tivesse, o PostgREST devolveria 401 com `42501`. Portanto **a única
coisa que limita a leitura é o RLS**.

**O que isso NÃO prova:** todas voltaram **vazias**, e o banco nasceu em
31/08/2026. Não dá para distinguir "o RLS filtrou" de "a tabela está vazia".

🚨 **DESCONHECIDO, e é a pergunta mais importante em aberto:** se as policies
são `USING (true)` — como o `AUDIT.md` do projeto **anterior** relatava — então,
assim que houver leads na base, qualquer pessoa com a anon key lê nome,
telefone, e-mail e mensagens de todos eles. É PII de terceiros.

**Para fechar, com acesso admin:**

```sql
SELECT schemaname, tablename, rowsecurity
FROM pg_tables WHERE schemaname = 'public';

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
```

Se `qual` vier `true` em tabela com PII, é o achado S4 do audit valendo aqui.

---

## Segredos

**Desenho correto, e não deve ser desfeito:** as chaves de API ficam no
**Supabase Vault**, nunca em tabela. `api_keys_registry` guarda só o ponteiro
(`vault_secret_id`), o rótulo e o estado de validação.

A `whatsapp-send` busca a chave da Evolution por `get_vault_key("evolution")`;
a `email-send` faz o mesmo com `"resend"`. Nenhuma lê chave de `settings`.

Serviços com chave prevista: `apollo`, `apify`, `crustdata`, `tavily`, `pdl`,
`evolution`, `resend`. **Só a do Apollo é obrigatória** — é ela que faz
`is_workspace_ready` virar `true` e libera o app.

### 🚨 O que está exposto hoje

1. **`AUDIT.md` está versionado e traz `APOLLO_API_KEY` e `PDL_API_KEY` com o
   valor escrito por extenso.** Quem tem acesso ao repositório tem as duas.
   Apagar o arquivo não desfaz — o valor está no commit.
2. **`.env` está versionado.** O conteúdo é público por desenho
   (`VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_PUBLISHABLE_KEY`), então não é vazamento. **O risco é o
   `.gitignore` não mencionar `.env`**: a próxima chave real entra no commit sem
   resistência.
3. **`.claude/settings.local.json` está versionado** (37 KB).

---

## Ordem de correção proposta

| # | O quê | Por quê agora |
|---|---|---|
| 1 | autorização por usuário em `whatsapp-send` e `email-send` | **tem prazo**: vira exploração real no dia em que a Evolution conectar |
| 2 | assinatura nos dois webhooks | o `_shared/cron-auth.ts` já tem o molde pronto |
| 3 | autorização nas três que queimam crédito | custo direto |
| 4 | rotacionar Apollo e PDL, e limpar o `AUDIT.md` | já exposto |
| 5 | `.gitignore` com `.env` | evita o próximo vazamento |
| 6 | confirmar o RLS e endurecer o que estiver `USING (true)` | PII de terceiros |

⚠️ Nada disso foi aplicado. Este documento descreve o estado em 2026-08-31.
