#!/usr/bin/env python3
"""Gera o DDL da VPS a partir dos exports do Supabase -- lead-king (ProspectAI).

Mesma logica do gerador do diagnostico-vibe, adaptada:
  - enum app_role precisa ser criado antes das tabelas (user_roles.role usa)
  - 3 FKs apontam para auth.users (profiles.id, user_onboarding.user_id,
    user_roles.user_id) -- reapontadas para public.usuario
  - api_keys_registry.user_id NAO tem FK declarada no Supabase (soft
    reference) -- fica marcada como TODO, nao inventada
"""
import csv
import re
import pathlib

BASE = pathlib.Path("/home/claude/lead-king/docs")
ORIG = BASE / "origem"


def linhas_do_csv(caminho):
    out = []
    with open(caminho, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.reader(f, delimiter=";")):
            if i == 0:
                continue
            if row:
                out.append(row[0])
    return out


def celulas(linha):
    if not linha.startswith("|"):
        return None
    return [c.strip() for c in linha.strip().strip("|").split("|")]


def secao(linhas, titulo):
    dentro = False
    out = []
    for l in linhas:
        if l.startswith("## "):
            dentro = titulo.lower() in l.lower()
            continue
        if dentro:
            out.append(l)
    return out


esquema = linhas_do_csv(ORIG / "01_esquema.csv")

colunas = {}
for l in secao(esquema, "1. Colunas"):
    c = celulas(l)
    if not c or len(c) < 5 or c[0] in ("tabela", "---") or set(c[0]) <= set("-"):
        continue
    colunas.setdefault(c[0], []).append(
        {"nome": c[1], "tipo": c[2], "nulo": c[3], "default": c[4]}
    )

constraints = {}
for l in secao(esquema, "2. Constraints"):
    c = celulas(l)
    if not c or len(c) < 4 or c[0] in ("tabela", "---") or set(c[0]) <= set("-"):
        continue
    constraints.setdefault(c[0], []).append({"nome": c[1], "tipo": c[2], "def": c[3]})

indices = []
for l in secao(esquema, "3. Indices"):
    c = celulas(l)
    if not c or len(c) < 3 or c[0] in ("tabela", "---") or set(c[0]) <= set("-"):
        continue
    indices.append({"tabela": c[0], "nome": c[1], "def": c[2]})

triggers = []
for l in secao(esquema, "4. Triggers"):
    c = celulas(l)
    if not c or len(c) < 3 or c[0] in ("tabela", "---") or set(c[0]) <= set("-"):
        continue
    triggers.append({"tabela": c[0], "nome": c[1], "def": c[2]})

texto_func = "\n".join(linhas_do_csv(ORIG / "02_funcoes.csv"))
funcoes = re.findall(r"```sql\s*(CREATE OR REPLACE FUNCTION.*?)\s*```", texto_func, re.S)

# tabelas que referenciam auth.users -- coluna reapontada
REAPONTAR = {
    ("profiles", "id"),
    ("user_onboarding", "user_id"),
    ("user_roles", "user_id"),
}

saida = []
A = saida.append

A("-- ============================================================")
A("-- ProspectAI / lead-king -- esquema para o Postgres da VPS")
A("--")
A("-- Gerado a partir de docs/origem/*.csv, exportados do Supabase")
A("-- (projeto wsqbwljeuwzderdrjeve) em 2026-08-31.")
A("--")
A("-- O QUE FOI RETIRADO, E POR QUE")
A("--   * as 19 policies de RLS  -> usam auth.uid(), que e do Supabase")
A("--   * os GRANT para anon/authenticated/service_role -> papeis inexistentes aqui")
A("--   * a referencia a auth.users -> trocada por public.usuario")
A("--")
A("-- 🚨 NAO REPETIR O DESENHO DE ORIGEM. 6 das 11 tabelas (contact_lists,")
A("--    contacts, lead_searches, outreach_messages, scraping_jobs, settings)")
A("--    tinham policy USING(true) WITH CHECK(true) para o papel 'public' --")
A("--    ou seja, ABERTA TAMBEM PARA anon -- combinada com GRANT de")
A("--    DELETE/INSERT/SELECT/UPDATE para anon nas 11 tabelas. Isso batia com")
A("--    o achado S4 do AUDIT.md do projeto original. So nao vazou nada porque")
A("--    o banco estava vazio (0 linhas em todas as tabelas, medido em 31/08).")
A("--")
A("-- 🚨 A AUTORIZACAO PASSA A SER DA APLICACAO. Sem PostgREST publicando")
A("--    tabela, quem decide quem ve o que e o servico da VPS.")
A("-- ============================================================")
A("")
A("BEGIN;")
A("")
A("CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid() e cifra")
A("")

A("-- ------------------------------------------------------------")
A("-- 0. IDENTIDADE -- substitui auth.users do Supabase")
A("-- ------------------------------------------------------------")
A("-- TODO(decisao): definir se o login sera proprio ou reaproveitado de")
A("--   outro painel da VPS (ex.: o login do MoviZap/painel).")
A("CREATE TABLE IF NOT EXISTS public.usuario (")
A("    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),")
A("    email       text NOT NULL UNIQUE,")
A("    nome        text NOT NULL,")
A("    senha_hash  text,")
A("    ativo       boolean NOT NULL DEFAULT true,")
A("    criado_em   timestamptz NOT NULL DEFAULT now()")
A(");")
A("")

A("-- ------------------------------------------------------------")
A("-- 0.1 ENUM app_role -- user_roles.role depende dele")
A("-- ------------------------------------------------------------")
A("DO $$ BEGIN")
A("    CREATE TYPE public.app_role AS ENUM ('admin', 'supervisor', 'agent');")
A("EXCEPTION WHEN duplicate_object THEN NULL; END $$;")
A("")

ordem = ["contact_lists", "settings", "project_config",
         "contacts", "lead_searches", "scraping_jobs",
         "outreach_messages", "api_keys_registry",
         "profiles", "user_onboarding", "user_roles"]
resto = [t for t in colunas if t not in ordem]
ordem += resto

A("-- ------------------------------------------------------------")
A("-- 1. TABELAS")
A("-- ------------------------------------------------------------")
for t in ordem:
    if t not in colunas:
        continue
    A("")
    if t == "api_keys_registry":
        A("-- 🚨 TODO(revisao): user_id NAO tinha FOREIGN KEY declarada no Supabase")
        A("--    (referencia solta, sem integridade). Aqui ela FOI adicionada --")
        A("--    decisao de quem migra: manter a integridade ou soltar de novo.")
    A(f"CREATE TABLE IF NOT EXISTS public.{t} (")
    linhas_col = []
    for c in colunas[t]:
        tipo = c["tipo"]
        tipo = {"timestamp with time zone": "timestamptz",
                "character varying": "text",
                "ARRAY": "text[]",
                "USER-DEFINED": "public.app_role"}.get(tipo, tipo)
        d = "" if c["default"] == "-" else f" DEFAULT {c['default']}"
        n = "" if c["nulo"] == "YES" else " NOT NULL"
        linhas_col.append(f"    {c['nome']:<26} {tipo}{n}{d}")
    for k in constraints.get(t, []):
        d = k["def"]
        if "auth.users" in d:
            d = d.replace("auth.users", "public.usuario")
            linhas_col.append("    -- reapontada de auth.users para public.usuario")
            linhas_col.append(f"    CONSTRAINT {k['nome']} {d}")
        else:
            linhas_col.append(f"    CONSTRAINT {k['nome']} {d}")
    if t == "api_keys_registry":
        linhas_col.append(
            "    CONSTRAINT api_keys_registry_user_id_fkey "
            "FOREIGN KEY (user_id) REFERENCES public.usuario(id) ON DELETE CASCADE"
        )
    A(",\n".join(linhas_col))
    A(");")

A("")
A("-- ------------------------------------------------------------")
A("-- 2. INDICES")
A("-- ------------------------------------------------------------")
for i in indices:
    if "_pkey" in i["nome"] or i["nome"].endswith("_key"):
        continue
    d = i["def"]
    if not d.upper().startswith("CREATE"):
        continue
    d = d.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS", 1)
    d = d.replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS", 1)
    A(d + ";")

A("")
A("-- ------------------------------------------------------------")
A("-- 3. FUNCOES")
A("-- ------------------------------------------------------------")
A("-- 🚨 Vieram como estao no Supabase. TRES exigem revisao ANTES de usar --")
A("--    no Supabase as tres estavam com EXECUTE liberado para 'anon', SEM")
A("--    nenhuma verificacao interna de quem chama:")
A("--       get_vault_key      -- devolve o segredo em claro")
A("--       vault_read_secret  -- devolve qualquer segredo por uuid")
A("--       get_user_api_key   -- devolve a chave de qualquer usuario")
A("--    Comparar com list_project_secrets, que faz certo: verifica has_role")
A("--    admin e devolve so o valor MASCARADO. E o padrao a copiar.")
A("")
for f in funcoes:
    nome_m = re.search(r"FUNCTION\s+public\.(\w+)", f)
    nome = nome_m.group(1) if nome_m else "?"
    A(f"-- ---------- {nome}")
    if nome in ("get_vault_key", "vault_read_secret", "get_user_api_key"):
        A(f"-- 🚨 TODO(seguranca): {nome} nao verificava quem chama no Supabase.")
        A("--    Na VPS ela so e alcancavel pelo servico -- mas o servico PRECISA")
        A("--    aplicar a mesma checagem que list_project_secrets faz (has_role).")
    if nome == "handle_new_user":
        A("-- 🚨 TODO(revisao): e o trigger que promove o 1o usuario a admin")
        A("--    (count(profiles)=0). Precisa de equivalente na tabela public.usuario")
        A("--    ou de rotina propria de cadastro do primeiro admin.")
    A(f + ";")
    A("")

A("-- ------------------------------------------------------------")
A("-- 4. TRIGGERS")
A("-- ------------------------------------------------------------")
for tg in triggers:
    d = tg["def"]
    A(f"DROP TRIGGER IF EXISTS {tg['nome']} ON public.{tg['tabela']};")
    A(d + ";")

A("")
A("-- ------------------------------------------------------------")
A("-- 5. O QUE NAO FOI TRAZIDO -- decisoes em aberto")
A("-- ------------------------------------------------------------")
A("-- 5.1 As 19 policies de RLS do Supabase. TODO(decisao): filtro na")
A("--     aplicacao (padrao dos outros projetos da VPS) ou RLS proprio.")
A("--")
A("-- 5.2 6 das 11 tabelas eram USING(true) WITH CHECK(true) para 'public' --")
A("--     NAO RECRIAR ASSIM. E o achado mais grave dos dois projetos.")
A("--")
A("-- 5.3 handle_new_user (1o usuario vira admin) precisa de equivalente.")
A("--")
A("-- 5.4 has_role(uuid, app_role) e usada pelas policies e por")
A("--     list_project_secrets -- ela continua util como funcao auxiliar,")
A("--     so nao like RLS.")
A("")
A("COMMIT;")
A("")

destino = BASE / "DB_SCHEMA.sql"
destino.write_text("\n".join(saida) + "\n", encoding="utf-8")

print(f"gravado {destino}")
print(f"  tabelas : {len([t for t in ordem if t in colunas])}")
print(f"  colunas : {sum(len(v) for v in colunas.values())}")
print(f"  constraints: {sum(len(v) for v in constraints.values())}")
print(f"  indices : {len(indices)}")
print(f"  triggers: {len(triggers)}")
print(f"  funcoes : {len(funcoes)}")
print(f"  linhas  : {len(saida)}")
