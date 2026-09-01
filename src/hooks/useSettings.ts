import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";

// Non-secret app settings (workspace, defaults, evolution URL -- NEVER keys)
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

export interface ApiKeyStatus {
  service_name: string;
  configured: boolean;
  // O backend novo nao guarda/expoe valor mascarado (a chave e cifrada e
  // nunca sai do banco em texto) -- o campo antigo existia so na Supabase.
  masked_value?: string;
  validation_status: "valid" | "invalid" | "unknown";
  last_validated_at: string | null;
  label: string | null;
  updated_at: string | null;
}

export type ApiKeysMap = Record<string, ApiKeyStatus>;

// ─── App Settings ───
export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiFetch<AppSettings>("/settings"),
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AppSettings>) =>
      apiFetch("/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ─── Onboarding state ───
export interface OnboardingState {
  workspace_ready: boolean;
  user_completed: boolean;
  is_admin: boolean;
}

export function useOnboardingState() {
  return useQuery({
    queryKey: ["onboarding-state"],
    queryFn: () => apiFetch<OnboardingState>("/onboarding"),
    staleTime: 10_000,
  });
}

export function useMarkUserOnboarded() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/onboarding/complete", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });
}

export function useResetUserOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/onboarding/reset", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-state"] }),
  });
}

export function useIsOnboarded() {
  const { data, isLoading } = useOnboardingState();
  const workspaceReady = !!data?.workspace_ready;
  const userCompleted = !!data?.user_completed;
  const isAdmin = !!data?.is_admin;
  const isOnboarded = isAdmin ? userCompleted : true;
  return { isOnboarded, isLoading, workspaceReady, userCompleted, isAdmin };
}

// ─── API Keys (admin-only) ───
export function useApiKeys() {
  return useQuery({
    queryKey: ["api-keys"],
    queryFn: () => apiFetch<ApiKeysMap>("/api-keys"),
  });
}

export function useSaveApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { service_name: string; api_key: string; label?: string; evolution_api_url?: string }) =>
      apiFetch<{ success: boolean; valid: boolean; message: string; warning?: string | null }>("/api-keys", {
        method: "POST", body: JSON.stringify(params),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useTestApiKey() {
  return useMutation({
    mutationFn: (params: { service_name: string; api_key: string; evolution_api_url?: string }) =>
      apiFetch<{ valid: boolean; message: string; warning?: string | null }>("/api-keys", {
        method: "POST", body: JSON.stringify({ ...params, validate_only: true }),
      }),
  });
}

export function useDeleteApiKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (service_name: string) => apiFetch(`/api-keys/${service_name}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });
}

export function useTestKey() {
  return useTestApiKey();
}

export { ApiError };
