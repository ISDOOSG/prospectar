# Modelo de dados — o que migra e o que muda

**Fonte:** `docs/DB_CATALOGO.md` (esquema completo, exportado do Supabase por
SQL, 2026-08-31) — não mais o `types.ts` gerado. O detalhe coluna a coluna
está lá; aqui fica **o que muda na migração**.

🚨 **`docs/DB_SCHEMA.sql` já é o DDL para a VPS**, testado: roda sem erro,
8 testes funcionais passaram (inserção, trigger de contagem, CHECK de status,
UNIQUE de telefone, `has_role()`, `is_workspace_ready()`, `CASCADE`). O que
falhou de propósito: `get_vault_key()`, porque `vault.decrypted_secrets` é
exclusivo do Supabase — prova que o Vault não migra sozinho.

---

## O que a rodada anterior não sabia, e agora sabe

A primeira versão deste documento (lida só do `types.ts`) tinha 6 perguntas em
aberto. Todas fecharam com o banco de origem:

| Pergunta | Resposta |
|---|---|
| Há FK, CHECK, UNIQUE? | **Sim** — 10 CHECK, 6 FK (3 para `auth.users`), 3 UNIQUE |
| `settings` tem constraint de linha única? | **Não.** Só a PK. É convenção do código (`app-config` faz `limit(1).maybeSingle()`), não trava de banco |
| Quem atualiza `contact_lists.contacts_count`? | `trigger_update_list_count`, em `contacts` (INSERT/DELETE/UPDATE de `list_id`). **Testado na VPS: funciona** |
| `status`/`source`/`channel` têm CHECK? | **Sim**, quase todos — ver tabela abaixo. Exceção: `outreach_messages.direction` continua texto livre |
| Índice em `contacts.phone`/`email`? | **`phone` sim** (é `UNIQUE`, cria índice). **`email` não tem índice nenhum** |
| Conteúdo de `project_config`? | Continua **DESCONHECIDO** — 0 linhas desde sempre |

---

## Os CHECK de domínio, por tabela

| Tabela.coluna | Valores permitidos |
|---|---|
| `contacts.status` | novo, contatado, qualificado, descartado |
| `contacts.platform` | linkedin, instagram, both |
| `contacts.source` | 26 valores fixos (apollo_search, google_maps, apify_*, firecrawl…) |
| `lead_searches.status` | pending, running, completed, failed |
| `lead_searches.source` | os mesmos 26 + `all` |
| `outreach_messages.channel` | whatsapp, email, instagram_dm |
| `outreach_messages.status` | sent, delivered, read, failed, pending |
| `scraping_jobs.status` | pending, running, completed, failed |
| `profiles.status` | online, offline, away, busy |
| `api_keys_registry.validation_status` | valid, invalid, unknown |

⚠️ **`outreach_messages.direction` não tem CHECK** — só `DEFAULT 'outbound'`.
É o único domínio de texto ainda solto.

## As FOREIGN KEY, com `ON DELETE`

| FK | Comportamento |
|---|---|
| `contacts.list_id` → `contact_lists.id` | `SET NULL` |
| `lead_searches.target_list_id` → `contact_lists.id` | `SET NULL` |
| `scraping_jobs.target_list_id` → `contact_lists.id` | `SET NULL` |
| `profiles.id` → `auth.users.id` | `CASCADE` — reapontada para `public.usuario` |
| `user_onboarding.user_id` → `auth.users.id` | `CASCADE` — idem |
| `user_roles.user_id` → `auth.users.id` | `CASCADE` — idem |

🚨 **`api_keys_registry.user_id` NÃO tinha FK no Supabase** — referência
solta, sem integridade. O `DB_SCHEMA.sql` **adicionou** a FK (`CASCADE` para
`public.usuario`) por decisão de quem migra. Se preferir manter solta como
estava, é reverter uma linha — está marcado com `TODO(revisao)` no arquivo.

## `api_keys_registry`: é por projeto, não por usuário

`api_keys_registry_service_name_unique` é **UNIQUE index no `service_name`
sozinho** — não em `(user_id, service_name)`. Ou seja: só pode existir **uma**
chave Apollo no projeto inteiro, não uma por usuário, mesmo a tabela tendo
coluna `user_id`. Isso confirma a nota da memória do Lovable: *"o Vault é por
projeto"*. `get_user_api_key(user_id, service)` existe mas, na prática,
qualquer usuário lendo a chave do serviço lê a **mesma** chave.

## Enum `app_role`

```
admin | supervisor | agent
```

`supervisor` continua sem uso em lugar nenhum do código — decisão em aberto no
`05_Pendencias.md`.

---

## As 11 tabelas + a que a migração acrescenta

O `DB_SCHEMA.sql` cria **12**: as 11 originais mais `public.usuario`, que
substitui `auth.users`. Tabela mínima — só o que fecha as FKs — porque o
sistema de login da VPS ainda não foi escolhido.

Ver `docs/DB_CATALOGO.md` para colunas, tipos e defaults completos, coluna a
coluna, tal como estavam no Supabase.
