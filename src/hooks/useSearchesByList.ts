import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { LeadSearch } from "@/lib/types";

export function useSearchesByList(listId: string | undefined) {
  return useQuery({
    queryKey: ["lead_searches", { listId }],
    queryFn: () => apiFetch<LeadSearch[]>(`/lead-searches?target_list_id=${listId}`),
    enabled: !!listId,
  });
}
