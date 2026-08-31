import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * supabase-js throws a generic "Edge Function returned a non-2xx status code"
 * and hides the real payload. The Response lives in `error.context`, so read it
 * and prefer `error`/`message` from the JSON body.
 */
export async function extractFunctionError(error: unknown, fallback = "Erro inesperado"): Promise<Error> {
  const generic = error instanceof Error ? error.message : fallback;
  const context = (error as { context?: unknown })?.context;

  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      const message = body?.error ?? body?.message;
      if (typeof message === "string" && message.trim()) return new Error(message);
    } catch {
      try {
        const text = (await context.clone().text()).trim();
        if (text) return new Error(text);
      } catch {
        // fall through to generic message
      }
    }
  }

  return new Error(generic);
}


// Non-secret app settings (workspace, defaults, evolution URL — NEVER keys)
export interface AppSettings {
  id: string;
  workspace_name: string;
  default_country: string;
  default_language: string;
  default_volume: number;
  auto_enrich: boolean;
  onboarding_completed: boolean;
  evolution_api_url: string;
  evolution_instance_name: string;
  evolution_connected: boolean;
  resend_from_email: string;
  resend_from_name: string;
}

// API key status (masked, from Vault registry)
export interface ApiKeyStatus {
  service_name: string;
  configured: boolean;
  masked_value: string;
  validation_status: "valid" | "invalid" | "unknown";
  last_validated_at: string | null;
  label: string | null;
  updated_at: string | null;
}

export type ApiKeysMap = Record<string, ApiKeyStatus>;

// ─── App Settings (non-secret) ───
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("app-config", {
        body: { action: "get" },
      });
      if (error) throw error;
      return data.settings as AppSettings;
    },
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      const { error } = await supabase.functions.invoke("app-config", {
        body: { action: "save", data },
      });
      if (error) throw await extractFunctionError(error, "Não foi possível salvar as configurações");

    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

// ─── Onboarding state (Vault-backed + per-user) ───
export interface OnboardingState {
  workspace_ready: boolean; // Apollo key present in vault
  user_completed: boolean;  // Current user marked own onboarding complete
  is_admin: boolean;
}

export function useOnboardingState() {
  return useQuery({
    queryKey: ["onboarding-state"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("app-config", {
        body: { action: "get_onboarding_state" },
      });
      if (error) throw error;
      return data as OnboardingState;
    },
    staleTime: 10_000,
  });
}

export function useMarkUserOnboarded() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("app-config", {
        body: { action: "mark_user_onboarded" },
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });
}

export function useResetUserOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("app-config", {
        body: { action: "reset_user_onboarding" },
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });
}

// Combined hook for App routing logic
export function useIsOnboarded() {
  const { data, isLoading } = useOnboardingState();
  const workspaceReady = !!data?.workspace_ready;
  const userCompleted = !!data?.user_completed;
  const isAdmin = !!data?.is_admin;
  // All integrations are optional. Admins complete the wizard once;
  // non-admins always get direct access to the dashboard.
  const isOnboarded = isAdmin ? userCompleted : true;
  return {
    isOnboarded,
    isLoading,
    workspaceReady,
    userCompleted,
    isAdmin,
  };
}

// ─── API Keys (Vault-backed, admin-only) ───
export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("api-keys-list", { body: {} });
      if (error) throw error;
      return data.keys as ApiKeysMap;
    },
  });
}

export function useSaveApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      service_name: string;
      api_key: string;
      label?: string;
      evolution_api_url?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("api-keys-save", { body: params });
      if (error) throw await extractFunctionError(error, "Não foi possível salvar a chave");
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; valid: boolean; message: string; warning?: string | null };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useTestApiKey() {
  return useMutation({
    mutationFn: async (params: {
      service_name: string;
      api_key: string;
      evolution_api_url?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("api-keys-save", {
        body: { ...params, validate_only: true },
      });
      if (error) throw await extractFunctionError(error, "Não foi possível testar a chave");
      if (data?.error) throw new Error(data.error);
      return data as { valid: boolean; message: string; warning?: string | null };
    },
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (service_name: string) => {
      const { error } = await supabase.functions.invoke("api-keys-delete", { body: { service_name } });
      if (error) throw await extractFunctionError(error, "Não foi possível remover a chave");

    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

// Backward-compat shim used by older components — maps service to keyType for tests
export function useTestKey() {
  return useTestApiKey();
}
