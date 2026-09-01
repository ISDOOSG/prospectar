import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export function useCreateContactList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      apiFetch("/contact-lists", { method: "POST", body: JSON.stringify({ name, description: description || "" }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact_lists"] }),
  });
}
