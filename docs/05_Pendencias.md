# Pendências — Fase 1 da migração

## 🟢 Adiantado em 31/08 — sem esperar as decisões pendentes

Detalhe completo em **`06_Provisionamento_VPS.md`** (documento próprio deste
projeto — cada um dos três tem o seu). Resumo: banco real `leadking`
provisionado, `DB_SCHEMA.sql` rodado (12 tabelas), credencial em `.env.db`,
porta **8010** reservada.

⚠️ Não substitui B.9 (broker OAuth), B.1-B.8 nem o checklist F/G — é só a
fundação de banco/porta/versionamento, que dava para adiantar sem esperar
por elas.

Estado em 2026-08-31, depois da extração completa do banco de origem e da
validação do `DB_SCHEMA.sql` na VPS.

---

## A. Já resolvido nesta rodada — não reperguntar

Fechadas pelas 3 consultas SQL e pelos 8 testes na VPS: existência de FK,
CHECK, UNIQUE e índices · quem atualiza `contacts_count` · domínio de
`status`/`source`/`channel` · se `settings` tem constraint de linha única
(não tem) · se `api_keys_registry` é por usuário ou por projeto (é por
projeto) · se o DDL executa e funciona (executa e funciona).

## B. Decisões de arquitetura — bloqueiam a Fase 1

| # | Decisão | Contexto |
|---|---|---|
| **B.1** | 🔴 **Onde o cofre de segredos vive na VPS** | o Vault do Supabase não migra (`vault.decrypted_secrets` não existe fora dele). Padrão da VPS é `.env` — decidir se `api_keys_registry` continua existindo só como índice, ou se cai fora |
| **B.2** | 🔴 **Provedor de IA** | `generate-opener` e `lead-search-ai-chat` usam o Lovable AI Gateway, que não migra. O MoviChat já usa DeepSeek na VPS — reaproveitar? |
| **B.3** | **Onde este projeto roda** | mencionado como possível sub-domínio do ImagoHub, ainda não decidido |
| **B.4** | **Sistema de login** | `public.usuario` no `DB_SCHEMA.sql` é mínimo, só para as FKs fecharem. Precisa de rotina de cadastro (equivalente a `handle_new_user`), hash de senha, e decidir se reaproveita login de outro painel — ver **B.9**, que muda o tamanho desta tarefa |
| **B.5** | **`api_keys_registry.user_id` sem FK no original** | o `DB_SCHEMA.sql` adicionou a FK por decisão de quem gerou. Confirmar se mantém |
| **B.6** | **`outreach_messages.direction` sem CHECK** | único domínio de texto ainda solto — adicionar CHECK ou deixar livre? |
| **B.7** | **`supervisor` no enum `app_role`** | existe, nunca foi usado no código. Manter, usar, ou remover? |
| **B.8** | **`project_config`** | 0 linhas desde sempre, propósito desconhecido. Manter a tabela vazia ou descartar? |
| **B.9** | 🔴 **O login usa `@lovable.dev/cloud-auth-js` — broker da PLATAFORMA Lovable, não do Supabase** | achado em 31/08, `src/integrations/lovable/index.ts`. `AnimatedAuthForm.tsx` chama `lovable.auth.signInWithOAuth("google"\|"apple"\|"microsoft")`, que fala com a infra da Lovable e só depois grava a sessão no Supabase. **Isso não migra de jeito nenhum** — não é como o Vault (que tem substituto óbvio, `.env`). Precisa de OAuth direto (credenciais próprias no Google Cloud Console etc.) ou trocar para e-mail/senha, como o `diagnostico-vibe` já faz |

## C. Correções de segurança — antes de expor a app a usuário real

| # | O quê |
|---|---|
| **C.1** | 🔴 Não recriar RLS `USING(true)` nem GRANT de `anon` para nenhuma tabela — a arquitetura da VPS já evita isso por desenho, mas vale checar no código do serviço que nada abre rota sem autenticação |
| **C.2** | 🔴 Nenhuma rota devolve segredo em claro — só mascarado, como `list_project_secrets` já fazia certo |
| **C.3** | Assinar os dois webhooks (`apollo-phone-webhook`, `evolution-webhook`) — copiar o padrão que a VPS já usa no MoviZap |
| **C.4** | Preservar a regra do nono dígito em `lead-search-execute` ao portar — é fácil de perder numa reescrita |

## D. Onde este documento se encaixa no plano maior

Você pediu um padrão para os próximos projetos que chegarem da mesma forma
(Lovable → GitHub → clonar na VPS → diagnosticar → extrair banco). Este
projeto e o `diagnostico-vibe` são os dois primeiros a passar pelo processo
completo:

1. clonar o repositório do GitHub
2. rodar `PADRAO_extrair_supabase.sql` (3 blocos, exporta 3 CSV por projeto)
3. gerar `DB_SCHEMA.sql` + `DB_CATALOGO.md` + `DB_FUNCOES.md`
4. validar o DDL num banco de teste na VPS (criado e apagado na hora)
5. reescrever os 5 documentos no eixo de migração
6. **o que não veio no git nem por SQL vira plano de recriação nesta seção D**
   — aqui, neste projeto, tudo veio: código pelo git, banco pelo SQL. Não há
   "Fase 1 de reconstrução do zero" — é literalmente rodar o `DB_SCHEMA.sql`
   e portar o código das 15 funções.

## E. O que falta, fora do banco

- O `.env` do projeto original não migra (chaves do Supabase, específicas
  dele). As chaves de terceiros (Apollo, Apify, Tavily, PDL, CrustData,
  Resend, Evolution) — se existirem — precisam ser recadastradas.
- Nenhuma chave real existia no projeto (confirmado: registry vazio), então
  não há segredo de terceiro para recuperar ou rotacionar aqui.

## F. Infraestrutura de implantação — nada disto foi feito ainda

Checklist que faltava neste documento, adicionado em 31/08:

| # | O quê | Nota |
|---|---|---|
| **F.1** | vhost nginx | padrão dos outros 4 projetos da VPS — replicar, não inventar |
| **F.2** | unit systemd (`--user`), `Restart=on-failure` | idem |
| **F.3** | Limpar dependências de build específicas da Lovable | `lovable-tagger` no `package.json`/`vite.config.ts` — só ativa em modo dev, não bloqueia `vite build`, mas é lixo a tirar. **`@lovable.dev/cloud-auth-js` sai junto com a solução de B.9** |
| **F.5** | ~~Onde o serviço roda / subdomínio~~ ✅ **DECIDIDO 01/09** | `prospectar.imagohub.com.br` — registro A criado por ele e resolvendo. Ver `06_Provisionamento_VPS.md` |
| **F.4** | Evolution: apontar para instância interna | `settings.evolution_api_url` é campo configurável, não fixo. Se apontar para `evolution.movisat.com.br` (a mesma VPS), o item deixa de ser conexão externa |

## G. O que já está ligado e o que não está, na esteira da VPS

| Item | Estado |
|---|---|
| clone em `/home/claude/imagohub/lead-king` | **feito** em 31/08 |
| banco real + `.env.db`/`.pgpass` | **feito** em 31/08 — ver `06_Provisionamento_VPS.md` |
| `.gitignore` cobrindo `.pgpass`/`.env.db` | **feito** em 31/08 — confirmado com `git check-ignore` |
| backup das 02:00 | **ligado** em 31/08 — `empacotar lead-king` no `backup_projetos.sh`, exclusão de `.pgpass` testada |
| cópia para `C:\code\BACKUP` | segue automaticamente do item acima, na próxima rodada de 02:00→04:30 |
| autocommit das 23:30 | **ligado** em 31/08 — `lead-king` entrou no `REPOS` |
| trava de segredo (`gate_segredos.py`) | ✅ **passa** — exceção para `PUBLISHABLE_KEY=` autorizada e aplicada em 31/08 |

✅ **Resolvido em 31/08.** A trava ganhou uma exceção restrita a
`PUBLISHABLE_KEY=` — o nome que o próprio Supabase dá à metade do par que é
segura de expor. Testada em três frentes antes de aplicar: os 3 projetos
novos passam agora; os outros 6 repositórios continuam exatamente como
estavam; e um teste negativo (uma `SECRET_KEY` de verdade ao lado de uma
`PUBLISHABLE_KEY`, num repositório descartável) confirmou que a exceção não
abre brecha — o `SECRET_KEY` continua bloqueando. Detalhe em
`/home/claude/scripts/gate_segredos.py`, comentário de 31/08.
