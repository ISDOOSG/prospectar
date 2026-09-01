# Documentação do Lead King (repositório `discover-leads`)

> Criada em 2026-08-31, antes de qualquer alteração de código.
> O projeto nasceu como remix do Lovable em 31/08/2026 e chegou aqui com
> **zero documentação de banco**. Esta pasta é a fonte disso.

## Como ler

| Marca | O que significa |
|---|---|
| **MEDIDO** | conferido contra o código ou contra o Supabase, com o comando registrado |
| **INFERIDO** | deduzido por convenção de nome ou leitura de uso — não confirmado |
| **DESCONHECIDO** | precisa de acesso admin ao Supabase ou de decisão do dono |

Regra: nada aqui é afirmado sem uma dessas três marcas. Se um número aparecer
sem marca, é erro de quem escreveu.

## Os documentos

| Arquivo | O que cobre |
|---|---|
| `01_Modelo_Dados.md` | as 11 tabelas, 104 colunas, enums, funções de banco, relações |
| `02_Edge_Functions.md` | as 15 funções, o que cada uma faz e o que gasta |
| `03_Acesso_e_Papeis.md` | quem pode o quê: RLS, papéis, Vault, e as três camadas de proteção |
| `04_Pendencias.md` | o que falta descobrir e o que falta decidir |

## O que este projeto é

**ProspectAI** — painel de prospecção B2C: busca leads (pessoas físicas),
enriquece com dados de terceiros, e aborda por WhatsApp e e-mail.

**Pilha** — React 18 + Vite + TypeScript + Tailwind + shadcn/ui no cliente;
Supabase (Postgres, Edge Functions em Deno, Vault) no servidor; Lovable AI
Gateway para a parte de IA.

**Projeto Supabase:** `wsqbwljeuwzderdrjeve` (MEDIDO — `supabase/config.toml`).

⚠️ O `AUDIT.md` da raiz do repositório fala do projeto `nqnavnodguhpmjhpsddo`,
que é **outro backend** — o do projeto original, antes do remix. Os achados de
banco dele não valem aqui sem reconferência; os de código valem.

## 🚨 O que não existe, e por que importa

**Não há `supabase/migrations/`.** MEDIDO em 31/08: nem migrations, nem
`seed.sql`, nem `schema.sql`, nem DBML, nem diagrama. O esquema existe apenas
dentro do projeto Supabase.

Isso significa que **o banco não é reproduzível a partir deste repositório**.
Clonar o repo em outra máquina dá o frontend e as funções, não o banco. A
única descrição do esquema é `src/integrations/supabase/types.ts`, que é
**gerado** — serve para ler, não para recriar.

O `01_Modelo_Dados.md` foi escrito a partir dele justamente para o
conhecimento não morar só num arquivo que a ferramenta regenera.
