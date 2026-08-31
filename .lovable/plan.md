

## Onboarding redesign: gating por estado real do Vault + per-user

### Problema atual

- `onboarding_completed` é **global** (1 linha em `settings`). Quando o 1º admin termina o setup, ele fica `true` para sempre — qualquer novo admin (ou o mesmo admin após um wipe do Vault) entra direto no `/` mesmo sem chaves configuradas.
- A condição de "onboarded" deveria depender do estado **real** do Vault (Apollo configurado), não de um boolean que pode mentir.
- Agentes não-admin caem no `/setup` mas **não conseguem** salvar nada (RLS de `set_project_secret` exige admin) → beco sem saída.

### Mudanças propostas

**1. Banco — gating per-user + readiness real**
- Migration: cria tabela `user_onboarding (user_id uuid PK, completed_at timestamptz)`.
  - RLS: usuário lê/escreve apenas a própria linha.
- Migration: cria função `is_workspace_ready()` SECURITY DEFINER que retorna `true` se existir linha em `api_keys_registry` com `service_name='apollo'` e `is_active=true`. Acessível a `authenticated`.
- Remove dependência de `settings.onboarding_completed` para o gating (mantém o campo apenas como flag legada/informativa).

**2. Edge function — `app-config` ganha 2 ações**
- `get_onboarding_state` → retorna `{ workspace_ready: boolean, user_completed: boolean, is_admin: boolean }`.
- `mark_user_onboarded` → faz upsert em `user_onboarding` para o `auth.uid()` atual.

**3. Frontend — `useIsOnboarded` reescrito**
- Substitui o hook em `src/hooks/useSettings.ts` por `useOnboardingState()` que chama `get_onboarding_state`.
- Lógica de "está onboarded":
  - **Admin**: precisa `workspace_ready === true` E `user_completed === true`.
  - **Agent/Supervisor**: precisa apenas `workspace_ready === true` (não consegue configurar Vault, então só espera o admin terminar).

**4. `RequireOnboarding` em `App.tsx`**
- Usa o novo hook.
- Se admin sem workspace pronto OU sem user_completed → `/setup`.
- Se agent/supervisor sem workspace pronto → mostra tela `WaitingForAdminSetup` (não `/setup`), explicando "aguarde o admin configurar as integrações".
- Caso contrário libera acesso.

**5. `OnboardingPage` ajustes**
- No final do wizard, em vez de gravar `onboarding_completed: true` em `settings`, chama `mark_user_onboarded` (per-user).
- Bloqueia o wizard para não-admins exibindo a tela `WaitingForAdminSetup` direto (eles não têm permissão para gravar no Vault de qualquer forma).
- Validação extra no `handleFinish`: confirma que `apollo` ficou de fato no registry (chama `get_onboarding_state` antes de redirect) — se não, mostra erro e mantém o usuário no wizard.

**6. `SettingsPage` — botão "Reconfigurar"**
- Em vez de marcar `onboarding_completed: false` no settings global, deleta a linha `user_onboarding` do usuário atual e redireciona para `/setup`. O Vault não é apagado (chaves continuam válidas para os outros usuários).
- Adiciona botão "Apagar todas as chaves do Vault e refazer setup" (admin-only, com confirmação) que chama `delete_project_secret` para todos os serviços conhecidos antes de mandar para `/setup`.

### Resultado esperado por persona

| Cenário | Comportamento |
|---|---|
| 1º admin loga | `/setup` (wizard completo, Apollo obrigatório) |
| Admin já configurou + 2º admin loga | `/setup` apenas para o 2º admin marcar `user_onboarded=true`. Pula campos de chave já preenchidos (mostra "✅ já configurado pelo workspace") |
| Agent loga em workspace pronto | Acesso direto |
| Agent loga em workspace NÃO pronto | Tela "Aguardando configuração do admin" |
| Admin clica "Reconfigurar" | Vai para `/setup`, vê chaves atuais mascaradas, pode pular ou alterar |
| Admin clica "Wipe + Reconfigurar" | Vault esvaziado, todos voltam ao `/setup` ou tela de espera |

### Arquivos afetados

- **Novo SQL migration**: `user_onboarding` table + `is_workspace_ready()` function
- **`supabase/functions/app-config/index.ts`**: +2 actions
- **`src/hooks/useSettings.ts`**: novo `useOnboardingState`, ajusta `useIsOnboarded`
- **`src/App.tsx`**: `RequireOnboarding` usa novo hook + branch para "waiting"
- **`src/pages/OnboardingPage.tsx`**: detecta admin vs não-admin, chama `mark_user_onboarded`, mostra status pré-preenchido para 2º+ admin
- **`src/pages/SettingsPage.tsx`**: botão "Reconfigurar" per-user + opção "Wipe Vault" admin-only
- **Novo `src/components/WaitingForAdminSetup.tsx`**: tela de espera para agents

### Decisões técnicas

- Mantemos `settings.onboarding_completed` para compatibilidade mas não é mais consultado pelo gating.
- `is_workspace_ready()` consulta apenas a presença da chave Apollo (mínimo viável). Outras chaves são opcionais.
- Não criamos UI para promoção de roles aqui (escopo separado).

