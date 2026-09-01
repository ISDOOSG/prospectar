# Pendências — o que falta descobrir e o que falta decidir

Estado em 2026-08-31. Duas listas separadas de propósito: uma se resolve
medindo, a outra só com decisão do dono.

---

## A. Se resolve medindo — precisa de acesso admin ao Supabase

Todas as seis se respondem com o mesmo acesso, em uma sessão.

| # | Pergunta | Consulta |
|---|---|---|
| **1** | As policies de RLS são `USING (true)`? | `SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public'` |
| **2** | Existem FOREIGN KEY, CHECK e UNIQUE de verdade? | `SELECT conrelid::regclass, conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE connamespace='public'::regnamespace` |
| **3** | `settings` tem constraint de linha única? | idem, procurar UNIQUE |
| **4** | Há índice em `contacts.phone` e `contacts.email`? | `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public'` |
| **5** | Quem atualiza `contact_lists.contacts_count`? | `SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal` |
| **6** | O que `project_config` guarda? | `SELECT key, value FROM project_config` |

🚨 A **1** é a mais urgente das seis: se as policies forem permissivas, PII de
lead fica legível por qualquer um com a anon key assim que houver dados.

---

## B. Precisa de decisão — não é medição, é escolha

| # | Decisão | Contexto |
|---|---|---|
| **1** | **Reproduzir o esquema como código** | hoje o banco só existe dentro do Supabase. Sem migrations, o repositório não remonta o banco. A saída é gerar um `schema.sql` a partir do projeto e passar a versionar |
| **2** | **O que fazer com `supervisor`** | existe no enum, não é usado. Ou ganha função, ou sai |
| **3** | **O que fazer com `profiles.is_approved`** | NOT NULL no esquema, sem uso no frontend. É portão de aprovação de usuário ou herança morta? |
| **4** | **Domínio de `status`, `source`, `channel`, `direction`** | são texto livre. Sem CHECK ou enum, viram `novo`/`Novo`/`NEW` na mesma coluna |
| **5** | **Contrato de `custom_fields`** | cada fonte grava chaves diferentes. Ou vira contrato escrito, ou continua depósito |
| **6** | **A regra do nono dígito** | `lead-search-execute:34` insere `9` em celular de 10 dígitos quando o primeiro dígito é >= 6. É regra de negócio escondida em uma linha |
| **7** | **Rotacionar Apollo e PDL** | os valores estão no `AUDIT.md` versionado. Rotacionar é o único conserto |
| **8** | **Os tetos da busca** | 10 por lote no Apollo, 3 profissões, 2 consultas Tavily, 5 grupos no Facebook. Todos fixos em código, nenhum configurável |

---

## C. O que não entra nesta pasta

O `AUDIT.md` da raiz **fica onde está** e não foi movido para cá. Ele descreve
o projeto Supabase `nqnavnodguhpmjhpsddo`, que é o backend **anterior ao
remix** — não é este. Reconferi os achados de código e eles valem; os de banco
precisam ser refeitos contra `wsqbwljeuwzderdrjeve`.

Os 15 arquivos de `.firecrawl/` são documentação de fornecedor raspada da web
(Crustdata, pipe0, salestools), mais de 7.000 linhas. São material de pesquisa,
não documentação deste projeto, e por isso não estão indexados aqui.

---

## D. O que já está ligado e o que não está

| Item | Estado |
|---|---|
| clone em `/home/claude/lead-king` | **feito** em 31/08 |
| autocommit das 23:30 | ⚠️ **não** — o `REPOS` do `git_autocommit.sh` é nominal |
| trava de segredo (`gate_segredos.py`) | ⚠️ **não** — só roda dentro do autocommit |
| backup das 02:00 | ⚠️ **não** — o `empacotar` do `backup_projetos.sh` é nominal |
| cópia para `C:\code\BACKUP` | ⚠️ **não** — depende do backup da VPS acima |
| nginx / systemd | não se aplica por enquanto (não serve nada na VPS) |

🚨 Enquanto os três primeiros não forem ligados, **o que for codado aqui não é
commitado, não passa pela trava de segredo e não é copiado para lugar nenhum.**
