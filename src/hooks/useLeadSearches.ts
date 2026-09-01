import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { LeadSearch } from "@/lib/types";

export function useLeadSearches() {
  return useQuery({
    queryKey: ["lead_searches"],
    queryFn: () => apiFetch<LeadSearch[]>("/lead-searches"),
  });
}
