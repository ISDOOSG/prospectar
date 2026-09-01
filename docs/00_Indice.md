# Documentação do ProspectAI (`lead-king`, repositório `discover-leads`)

> Reescrita em 2026-08-31 no eixo de **migração para a VPS**. É meu, vai ficar
> aqui, e no fim o único acesso externo será o GitHub — nada de Supabase.

## Como ler

| Marca | O que significa |
|---|---|
| **MEDIDO** | conferido contra o código, contra o banco de origem, ou por teste na VPS |
| **INFERIDO** | deduzido por convenção de nome ou leitura de uso — não confirmado |
| **DESCONHECIDO** | precisa de decisão do dono |

## Ordem de leitura

| # | Arquivo | O que cobre |
|---|---|---|
| **1** | `01_O_Que_Esta_Ligado.md` | 🚨 comece aqui — o estado real de uso: zero |
| 2 | `02_Modelo_Dados.md` | as 11 tabelas, o que migra e o que muda |
| 3 | `03_Arquitetura.md` | as edge functions, o que cada uma vira na VPS |
| 4 | `04_Acesso_e_Seguranca.md` | 🔴 o achado mais grave dos dois projetos |
| 5 | `05_Pendencias.md` | o que falta decidir para a Fase 1 |
| 6 | `06_Provisionamento_VPS.md` | o banco real já provisionado, a porta reservada — o que já está pronto |

## Os artefatos de banco, gerados direto da fonte

Diferente da rodada anterior (que lia só `types.ts`, gerado e incompleto),
estes três vieram do **SQL Editor do Supabase**, com o esquema completo:

| Arquivo | O que é |
|---|---|
| `DB_SCHEMA.sql` | **o DDL para rodar na VPS** — já sem RLS, sem papéis do Supabase, com `auth.users` trocado por `public.usuario`. **Testado**: roda sem erro e passou em 8 testes funcionais |
| `DB_CATALOGO.md` | o banco de **origem**, como estava no Supabase — colunas, constraints, índices, triggers, RLS, policies, grants |
| `DB_FUNCOES.md` | o corpo das 17 funções, com nota em cada achado |
| `origem/*.csv` | os exports crus, para reconferência |

## O que este projeto é

**ProspectAI** — painel de prospecção B2C: busca leads (pessoas físicas),
enriquece com dados de terceiros, aborda por WhatsApp e e-mail.

**Pilha** — React 18 + Vite + TypeScript + Tailwind + shadcn/ui; Supabase
(Postgres, 15 Edge Functions em Deno, Vault) — o Supabase sai na migração.

**Projeto de origem:** `wsqbwljeuwzderdrjeve`. Postgres **17.6** — mais novo
que o `pg_dump` da VPS (16.15), por isso a extração foi feita pelo SQL Editor,
não por `pg_dump`.

## 🔴 O achado que decide a prioridade

6 das 11 tabelas tinham RLS `USING (true) WITH CHECK (true)` para o papel
**`public`** — todo mundo, `anon` incluído — somado a `GRANT` de leitura e
escrita completas para `anon`. Isso confirma o achado **S4** do `AUDIT.md`
original: o remix herdou o defeito. Só não vazou porque o banco nunca foi
usado. **Não recriar esse desenho na VPS.** Detalhe em
`04_Acesso_e_Seguranca.md`.
