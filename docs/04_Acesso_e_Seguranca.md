# Acesso e segurança — o que NÃO recriar na VPS

**MEDIDO** em 2026-08-31, direto no banco de origem (`wsqbwljeuwzderdrjeve`),
por SQL Editor. Este é o achado mais grave dos dois projetos migrados até
agora — mais grave que o do `diagnostico-vibe`.

---

# 🔴 1. Seis tabelas abertas para qualquer pessoa na internet

## A prova

**RLS (`pg_policies`):**

| Tabela | Policy | Papéis | USING | WITH CHECK |
|---|---|---|---|---|
| `contact_lists` | Allow all access to contact_lists | **public** | `true` | `true` |
| `contacts` | Allow all access to contacts | **public** | `true` | `true` |
| `lead_searches` | Allow all access to lead_searches | **public** | `true` | `true` |
| `outreach_messages` | outreach_messages_full_access | **public** | `true` | `true` |
| `scraping_jobs` | Allow all access to scraping_jobs | **public** | `true` | `true` |
| `settings` | settings_full_access | **public** | `true` | `true` |

Em Postgres, o papel **`public`** numa policy significa *literalmente todo
mundo* — inclui `anon`. Não é "todo usuário logado"; é qualquer requisição.

**GRANTs (`information_schema.role_table_grants`):**

Todas as 11 tabelas, incluindo as 6 acima, concedem
`DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` para **`anon`**
— a mesma chave que vai no bundle do navegador.

## O que isso soma

RLS `true` + GRANT completo para `anon` = **qualquer pessoa com a chave
pública lê, grava e apaga contatos, listas, buscas, mensagens e configuração,
sem login, sem token, sem nada.**

```bash
curl "https://wsqbwljeuwzderdrjeve.supabase.co/rest/v1/contacts?select=name,phone,email" \
  -H "apikey: <anon-key-do-bundle>"
```
funcionaria — e devolveria nome, telefone e e-mail de **todo** lead cadastrado.

## Isto já estava escrito, e não foi corrigido

O `AUDIT.md` da raiz do repositório (do projeto **original**, antes deste
remix) já registrava isso como **S4**:

> *RLS permissiva (`USING (true) WITH CHECK (true)`) em tabelas de PII...
> qualquer um com a anon key lê/escreve todos os leads (nome, telefone,
> e-mail, gênero), mensagens e a config Evolution direto via PostgREST*

O remix herdou o defeito. **Só não vazou nada porque o banco nunca foi
usado** — confirmado: 0 linhas em todas as 11 tabelas.

## 🚨 Para a VPS: não é "corrigir a policy". É desenhar diferente.

O `DB_SCHEMA.sql` já sai **sem** essas policies e **sem** os papéis
`anon`/`authenticated`. Na VPS não há PostgREST publicando tabela — a
aplicação decide o que cada requisição pode ver. Isso resolve o achado **por
arquitetura**, não por trava adicional.

O único cuidado: **o serviço da VPS precisa filtrar por dono** onde fizer
sentido (ex.: se um dia houver múltiplos operadores), porque nada no banco
vai fazer isso por ele.

---

# 🔴 2. Três funções do Vault sem verificação, abertas para `anon`

**Todas as 17 funções tinham `EXECUTE` concedido a `anon`.** O corpo de 4
delas foi lido:

| Função | Guarda interna | O que devolve |
|---|---|---|
| `list_project_secrets` | ✅ `IF NOT has_role(auth.uid(),'admin') RAISE EXCEPTION` | valor **mascarado** (`****`+4 dígitos) |
| **`get_vault_key`** | 🔴 nenhuma | o segredo **em claro** |
| **`vault_read_secret`** | 🔴 nenhuma | qualquer segredo, por uuid |
| **`get_user_api_key`** | 🔴 nenhuma | a chave de **qualquer** usuário |

O contraste prova que dava para fazer certo — uma das quatro faz. As outras
três não checam nada.

**Consequência:** hoje o registry está vazio, então nada vaza. O app só fica
"utilizável" (`workspace_ready = true`) depois que a chave Apollo é
configurada. Nesse momento, a mesma chamada HTTP que qualquer visitante do
site pode fazer devolve a chave da Apollo em claro.

## Testado na VPS: o Vault não migra sozinho

```
SELECT get_vault_key('apollo')
ERROR: relation "vault.decrypted_secrets" does not exist
```

`vault.decrypted_secrets` é infraestrutura exclusiva do Supabase. Migrar
exige um cofre próprio — ver `05_Pendencias.md`, item de decisão.

## 🚨 Para a VPS: copiar o padrão de `list_project_secrets`, não os outros três

Ao reimplementar a leitura de chave de API na VPS:
1. Guardar o segredo em `.env`, como todo o resto da VPS (nunca em tabela).
2. Se existir uma rota que devolve chave configurada, ela mostra **mascarado**,
   igual ao `list_project_secrets` — nunca o valor completo.
3. Nenhuma rota devolve segredo em claro para o cliente, ponto final. Quem
   precisa da chave em claro é o próprio serviço, no processo, nunca a
   resposta HTTP.

---

## Comparação com o `diagnostico-vibe`

| | `diagnostico-vibe` | `lead-king` |
|---|---|---|
| Tabelas abertas para `anon` via RLS | 0 (RLS restrita a `authenticated`) | **6 de 11** |
| Funções sem guarda, abertas para `anon` | 1 (`get_session_cookies`) | **3** (Vault) |
| O que vaza se explorado | cookie de sessão de um cliente por vez | **PII de todos os leads, de uma vez** |
| Gravidade | alta | **mais alta** — sem precisar de uuid nenhum, é `SELECT *` |

O `lead-king` é o pior dos dois casos porque a exposição **não exige saber
nenhum identificador** — é leitura de tabela inteira, sem parâmetro.

---

## Papéis e onboarding — o que funciona certo, para não jogar fora

- `has_role(uuid, app_role)` — checagem real, testada na VPS.
- `list_project_secrets` — padrão de trava correta (RAISE EXCEPTION + valor
  mascarado).
- `handle_new_user` — promove automaticamente o primeiro cadastro a `admin`.
  Precisa de equivalente na VPS, amarrado a `public.usuario` em vez de
  `auth.users` (marcado como `TODO` em `DB_SCHEMA.sql`).
- `api_keys_registry_service_name_unique` — é UNIQUE só em `service_name`,
  não em `(user_id, service_name)`: confirma que o Vault é **por projeto**,
  não por usuário, apesar da coluna `user_id` existir.
