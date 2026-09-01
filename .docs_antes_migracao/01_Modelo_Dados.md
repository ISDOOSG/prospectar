# Modelo de dados

**Fonte:** `src/integrations/supabase/types.ts` (662 linhas, gerado pelo
Supabase). **MEDIDO** em 2026-08-31: 11 tabelas, 104 colunas.

🚨 **Não há migrations.** Este documento é a única descrição do esquema em
linguagem humana. Se o `types.ts` for regenerado e algo mudar, este arquivo
precisa mudar junto — não há nada que force isso.

---

## O caminho do dado, em uma frase

Uma **busca** (`lead_searches`) produz **contatos** (`contacts`), que entram
numa **lista** (`contact_lists`), e que depois recebem **mensagens**
(`outreach_messages`) por WhatsApp ou e-mail.

`scraping_jobs` é o caminho paralelo: raspagem por URL, que também deposita em
`contacts`. `settings`, `user_roles`, `profiles`, `user_onboarding`,
`project_config` e `api_keys_registry` são apoio.

---

## As tabelas do fluxo principal

### `contacts` — 18 colunas · o coração

O lead. Só `name` é obrigatório de verdade; **nenhuma coluna é exigida no
INSERT**, o que quer dizer que um contato pode nascer praticamente vazio.

| Coluna | Tipo | Nulo | Nota |
|---|---|---|---|
| `id` | uuid | NOT NULL | |
| `name` | text | NOT NULL | |
| `phone` | text | NULL | onde o WhatsApp é enviado |
| `email` | text | NULL | |
| `company` · `title` · `city` | text | NULL | |
| `instagram` · `linkedin_url` | text | NULL | |
| `platform` · `source` | text | NULL | de onde veio (apollo, pdl, tavily, apify…) |
| `status` | text | NULL | **texto livre, sem enum** |
| `score` | number | NULL | |
| `tags` | text[] | NULL | |
| `list_id` | uuid | NULL | → `contact_lists.id` (INFERIDO) |
| `custom_fields` | Json | NULL | onde cada fonte despeja o que sobrou |
| `created_at` · `updated_at` | timestamp | NOT NULL | |

⚠️ **`status` e `source` são texto livre.** Não há enum nem CHECK visível no
`types.ts`. Quem escreve decide a grafia, e isso costuma virar
`"novo"`/`"Novo"`/`"NEW"` na mesma coluna. DESCONHECIDO se há CHECK no banco.

⚠️ **`custom_fields` é o depósito.** MEDIDO no `lead-search-execute`: cada
fonte grava chaves diferentes ali — `source_url`, `twitter_handle`, `bio`,
`followers`, `all_phones`, `all_emails`, `whatsapp`, `tavily_score`,
`profile_pic`, `gender`, `skills`, `interests`. Não há contrato nenhum sobre
esse conteúdo.

### `contact_lists` — 6 colunas

`name` obrigatório. `contacts_count` é **número desnormalizado** — DESCONHECIDO
quem o atualiza, e se há trigger. Se não houver, ele mente assim que um contato
entra ou sai.

### `lead_searches` — 14 colunas · a execução de uma busca

`name` e `source_reports` (Json) são NOT NULL. Guarda `config` (Json),
`status`, `contacts_found`, `contacts_new`, `duration_ms`, `started_at`,
`completed_at` e `target_list_id`.

É a tabela de auditoria do que a busca fez: `source_reports` registra o que
cada fonte devolveu.

### `outreach_messages` — 11 colunas · a abordagem

`channel`, `direction` e `message_text` são NOT NULL. `contact_id` → `contacts.id`
(a **única relação confirmada por nome exato**).

| Coluna | Nota |
|---|---|
| `channel` | whatsapp ou email — **texto livre, sem enum** |
| `direction` | entrada ou saída — **texto livre, sem enum** |
| `provider` · `provider_message_id` | quem entregou e o id lá fora |
| `status` | **texto livre** |
| `metadata` | Json |
| `sent_at` | NULL até enviar |

### `scraping_jobs` — 13 colunas

`url` obrigatório. Mesmo formato de `lead_searches`: `status`, `result_data`,
`contacts_found`, `contacts_valid`, `duration_ms`, `error_message`,
`target_list_id`, `fields` (text[]).

---

## As tabelas de apoio

### `settings` — 14 colunas · **linha única**

MEDIDO no `app-config`: a função faz `.select("*").limit(1).maybeSingle()` e,
se não achar, **cria uma** com `workspace_name: "ProspectAI"`. Ou seja, é uma
tabela de uma linha só, por convenção do código — DESCONHECIDO se há constraint
que garanta isso no banco.

Guarda o que **não é segredo**: `workspace_name`, `default_country`,
`default_language`, `default_volume`, `auto_enrich`, `onboarding_completed`,
`evolution_api_url`, `evolution_instance_name`, `evolution_connected`,
`resend_from_email`, `resend_from_name`.

🚨 **Chave de API não mora aqui.** A da Evolution vem do Vault, por
`get_vault_key`. Isso é desenho correto e não deve ser desfeito.

### `user_roles` — 4 colunas

`user_id` e `role` NOT NULL. `role` é o enum `app_role`.

### `profiles` — 9 colunas

`email`, `full_name`, `id`, `is_active` e **`is_approved`** são NOT NULL.

⚠️ **`is_approved` existe no esquema e não achei uso no frontend** (MEDIDO por
busca em `src/`). Ou é um portão de aprovação de usuário que ninguém ligou, ou
é herança do projeto original.

### `user_onboarding` — 2 colunas

`user_id` e `completed_at`. É o registro de quem terminou o `/setup`.

### `api_keys_registry` — 10 colunas

O **índice** das chaves, não as chaves. `service_name`, `user_id` e
`vault_secret_id` NOT NULL. Guarda `label`, `is_active`, `validation_status`,
`last_validated_at`. O segredo em si fica no Vault, apontado por
`vault_secret_id`.

### `project_config` — 3 colunas

`key` e `value`, ambos NOT NULL. Chave-valor genérico. DESCONHECIDO o que
guarda na prática.

---

## Enum

```
app_role = admin | supervisor | agent
```

⚠️ **`supervisor` existe e não é usado em lugar nenhum** — MEDIDO por busca em
`src/` e `supabase/`. Só `admin` e `agent` aparecem.

---

## Funções de banco (RPC)

MEDIDO no `types.ts`. As de Vault são o cofre; as de papel são a trava real.

| Função | Argumentos | Devolve | Para que serve |
|---|---|---|---|
| `has_role` | (user, role) | boolean | a checagem de papel |
| `is_workspace_ready` | — | boolean | true quando a chave Apollo está no Vault |
| `list_project_secrets` | — | linhas | **impõe admin com RAISE EXCEPTION** |
| `set_project_secret` | (…) | — | grava chave no Vault |
| `delete_project_secret` | (service) | — | |
| `get_vault_key` | (service) | text | lê a chave do Vault |
| `get_user_api_key` | (service, user) | text | chave por usuário |
| `vault_store_secret` | (nome, segredo, desc) | uuid | |
| `vault_read_secret` | (secret_id) | text | |
| `vault_update_secret` | (secret_id, novo) | — | |
| `vault_delete_secret` | (secret_id) | — | |
| `upsert_lead_contact` | (…) | — | entrada de contato pela busca |
| `_remix_introspect` | — | Json | do Lovable, não nosso |

🚨 **A trava de admin mora no Postgres, não no TypeScript.** MEDIDO: o
`api-keys-list` não checa papel em código — chama `list_project_secrets` e
converte a exceção em HTTP 403. Testado de fora: devolve
*"Apenas administradores podem listar chaves do projeto"*. É o desenho certo,
porque a trava não some se alguém reescrever a função de borda.

---

## Relações

**Confirmada por nome exato:**

```
outreach_messages.contact_id  ->  contacts.id
```

**INFERIDAS — o nome sugere, mas não há migration para confirmar:**

```
contacts.list_id           ->  contact_lists.id
lead_searches.target_list_id -> contact_lists.id
scraping_jobs.target_list_id -> contact_lists.id
user_roles.user_id         ->  auth.users.id
user_onboarding.user_id    ->  auth.users.id
profiles.id                ->  auth.users.id
api_keys_registry.user_id  ->  auth.users.id
api_keys_registry.vault_secret_id -> vault.secrets.id
```

⚠️ **DESCONHECIDO se existem FOREIGN KEY de verdade.** Sem migrations não dá
para saber se são chaves estrangeiras com integridade referencial ou apenas
colunas `uuid` soltas. A diferença importa: sem FK, apagar uma lista deixa
`contacts.list_id` apontando para o nada, em silêncio.

**Para fechar isso** basta uma consulta com acesso admin ao Supabase:

```sql
SELECT conrelid::regclass AS tabela, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace AND contype IN ('f','c','u')
ORDER BY 1;
```

---

## O que ainda não sei sobre este banco

1. Se há FOREIGN KEY, CHECK ou UNIQUE — nada disso aparece no `types.ts`.
2. Se `settings` tem constraint de linha única.
3. Quem atualiza `contact_lists.contacts_count`.
4. Se `status`, `source`, `channel` e `direction` têm CHECK de domínio.
5. Se há índice em `contacts.phone` e `contacts.email` — sem eles, a
   deduplicação de lead fica cara à medida que a base cresce.
6. O conteúdo real de `project_config`.

Todas se respondem com a consulta acima mais `\d+` nas tabelas.
