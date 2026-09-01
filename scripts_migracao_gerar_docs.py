#!/usr/bin/env python3
"""Gera DB_CATALOGO.md e DB_FUNCOES.md do lead-king a partir dos CSVs."""
import csv
import pathlib
import re

BASE = pathlib.Path("/home/claude/lead-king/docs")
ORIG = BASE / "origem"


def linhas(caminho):
    out = []
    with open(caminho, newline="", encoding="utf-8") as f:
        for i, row in enumerate(csv.reader(f, delimiter=";")):
            if i == 0 or not row:
                continue
            out.append(row[0])
    return out


esquema = linhas(ORIG / "01_esquema.csv")

checagens = []
with open(ORIG / "03_checagens.csv", newline="", encoding="utf-8") as f:
    for i, row in enumerate(csv.reader(f, delimiter=";")):
        if i == 0 or len(row) < 2:
            continue
        checagens.append((row[0], row[1]))

cab = [
    "# Catálogo do banco — ProspectAI (`lead-king`)",
    "",
    "> **Fonte:** exportado do Supabase `wsqbwljeuwzderdrjeve` em 2026-08-31,",
    "> pelo SQL Editor. Os CSVs crus estão em `docs/origem/`.",
    ">",
    "> Este documento é **o estado do banco de origem**, para consulta e para",
    "> comparação futura. O que vai rodar na VPS é o `DB_SCHEMA.sql`, que",
    "> **não é igual a isto**: as policies e os papéis do Supabase ficaram de",
    "> fora — e por bom motivo. Ver `04_Acesso_e_Seguranca.md`.",
    "",
    "---",
    "",
    "## Contagens no momento da exportação",
    "",
    "| pergunta | resposta |",
    "|---|---|",
]
for pergunta, resposta in checagens:
    cab.append(f"| {pergunta} | **{resposta}** |")

cab += [
    "",
    "🚨 **Tudo zero.** Nunca houve cadastro, chave configurada ou contato",
    "importado. É o que dá tempo de corrigir o achado de RLS antes do primeiro",
    "uso real — ver seção seguinte e `04_Acesso_e_Seguranca.md`.",
    "",
    "---",
    "",
    "## 🔴 O achado mais grave dos dois projetos migrados",
    "",
    "6 das 11 tabelas tinham policy `USING (true) WITH CHECK (true)` para o",
    "papel **`public`** — que em Postgres significa *todo mundo*, `anon`",
    "incluído. Combinado com `GRANT` de `DELETE, INSERT, SELECT, UPDATE` para",
    "`anon` nas 11 tabelas (seção 7 abaixo), isso significa:",
    "",
    "> **qualquer pessoa com a chave pública do bundle do navegador lia,",
    "> escrevia e apagava contatos, listas, buscas, mensagens e",
    "> configurações — sem login, sem token, sem nada.**",
    "",
    "As tabelas abertas: `contact_lists`, `contacts`, `lead_searches`,",
    "`outreach_messages`, `scraping_jobs`, `settings`.",
    "",
    "Isso confirma o achado **S4** do `AUDIT.md` do projeto original — a",
    "auditoria já sabia disso, e o remix herdou o defeito sem corrigir.",
    "",
    "Só não vazou nada porque o banco estava vazio o tempo todo. **Não recriar",
    "esse desenho na VPS** — é o TODO 5.2 do `DB_SCHEMA.sql`.",
    "",
    "---",
    "",
]

(BASE / "DB_CATALOGO.md").write_text(
    "\n".join(cab) + "\n".join(esquema) + "\n", encoding="utf-8"
)

# ---------- DB_FUNCOES.md --------------------------------------------------
texto = "\n".join(linhas(ORIG / "02_funcoes.csv"))
blocos = re.findall(r"(### \w+\s*```sql\s*CREATE OR REPLACE FUNCTION.*?```)", texto, re.S)

notas = {
    "get_vault_key": (
        "🚨 **Sem verificação de dono, EXECUTE aberto para `anon`.** Recebe o nome\n"
        "de um serviço e devolve a chave **em claro**. Testado na VPS: falha aqui\n"
        "só porque `vault.decrypted_secrets` é infraestrutura exclusiva do\n"
        "Supabase — a função em si não tem nenhuma trava."
    ),
    "vault_read_secret": (
        "🚨 **Sem verificação de dono, EXECUTE aberto para `anon`.** Devolve\n"
        "qualquer segredo do Vault, bastando o uuid."
    ),
    "get_user_api_key": (
        "🚨 **Sem verificação de dono, EXECUTE aberto para `anon`.** Devolve a\n"
        "chave de API de **qualquer usuário**, não só de quem chama."
    ),
    "list_project_secrets": (
        "✅ **A única das sete funções de Vault que faz certo.** Verifica\n"
        "`has_role(auth.uid(),'admin')` e levanta exceção se não for admin —\n"
        "e devolve o valor **mascarado** (`****`+4 dígitos), nunca em claro.\n"
        "É o padrão a copiar nas outras três."
    ),
    "handle_new_user": (
        "⚠️ Trigger em `auth.users` que promove o primeiro cadastro a admin\n"
        "(`count(profiles)=0`). Na VPS, sem `auth.users`, precisa de rotina\n"
        "equivalente amarrada a `public.usuario`."
    ),
    "has_role": (
        "✅ A checagem de papel real do sistema. Testada na VPS: funciona\n"
        "normalmente contra `public.usuario` + `user_roles`."
    ),
}

out = [
    "# Corpo das funções do banco — ProspectAI",
    "",
    "> **Fonte:** `pg_get_functiondef()` no Supabase `wsqbwljeuwzderdrjeve`,",
    "> 2026-08-31. CSV cru em `docs/origem/02_funcoes.csv`.",
    "",
    "🚨 **As 17 funções tinham `EXECUTE` concedido a `anon`.** Das sete que",
    "tocam o Vault, três não verificam quem chama — ver `04_Acesso_e_Seguranca.md`.",
    "",
    "⚠️ **Sete funções dependem do schema `vault` do Supabase**",
    "(`vault.decrypted_secrets`), que **não existe** num Postgres comum.",
    "Confirmado em teste na VPS: `get_vault_key` falha com",
    "`relation \"vault.decrypted_secrets\" does not exist`. Migrar o Vault",
    "exige trocar por um cofre próprio — ver `05_Pendencias.md`.",
    "",
    "---",
    "",
]

vistos = set()
for b in blocos:
    nome = re.search(r"###\s+(\w+)", b)
    nome = nome.group(1) if nome else "?"
    if nome in notas and nome not in vistos:
        out.append(b.split("```")[0].rstrip())
        out.append("")
        out.append(notas[nome])
        out.append("")
        out.append("```sql" + b.split("```sql", 1)[1])
        vistos.add(nome)
    else:
        out.append(b)
    out.append("")

(BASE / "DB_FUNCOES.md").write_text("\n".join(out) + "\n", encoding="utf-8")

print("DB_CATALOGO.md:", len((BASE / "DB_CATALOGO.md").read_text().splitlines()), "linhas")
print("DB_FUNCOES.md :", len((BASE / "DB_FUNCOES.md").read_text().splitlines()), "linhas")
print("funcoes documentadas:", len(blocos))
