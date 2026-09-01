# O que está ligado hoje

**MEDIDO** em 2026-08-31, pelo `remix-health-check` e pelas contagens do
banco de origem.

---

## O resumo

```
usable:           false
workspace_ready:  false   "No Apollo key — admin must complete /setup"
has_admin:        false   "No admin yet — first signup will be promoted"

integrações: apollo, apify, crustdata, tavily, pdl, evolution, resend
             -> TODAS "missing"
```

**Ninguém nunca se cadastrou.** Zero admin, zero chave configurada, zero
contato, zero lista, zero busca, zero mensagem. Confirmado nas 22 contagens
do `03_checagens` — todas zero — e é coerente com o que a memória do Lovable
registra: *"Nenhum dado seed no remix (banco vazio, schema only)"*.

## Por que isso muda a prioridade da migração

Não há dado real para migrar. A Fase 1 não é *transferir informação* — é
**recriar a estrutura correta antes que exista informação para proteger**.
É a melhor janela possível para consertar o achado de RLS.

## As 11 tabelas, uso teórico (por design, não por dado)

| Tabela | Papel no fluxo |
|---|---|
| `contacts` | o lead — coração do produto |
| `contact_lists` | agrupamento de contatos |
| `lead_searches` | execução de busca (Apollo, Apify, PDL, Tavily, CrustData) |
| `scraping_jobs` | raspagem por URL — caminho paralelo que também gera `contacts` |
| `outreach_messages` | abordagem por WhatsApp/e-mail |
| `api_keys_registry` + Vault | índice das chaves de API — projeto-wide, não por usuário (`service_name` é UNIQUE sozinho) |
| `settings` | linha única de configuração não secreta |
| `profiles`, `user_roles`, `user_onboarding` | identidade e papel |
| `project_config` | chave-valor genérico — **conteúdo real: DESCONHECIDO, nunca populado** |

Nenhuma tabela deste projeto é mobília no sentido do `diagnostico-vibe`
(existir sem código que a use) — o código usa as 11. O problema aqui não é
recurso não construído, é **superfície de acesso mal fechada** desde o início.
