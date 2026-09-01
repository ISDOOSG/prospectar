import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Contact } from "@/lib/types";

export function useContacts(filters?: { search?: string; status?: string; platform?: string }) {
  return useQuery({
    queryKey: ["contacts", filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters?.search) p.set("search", filters.search);
      if (filters?.status && filters.status !== "all") p.set("status", filters.status);
      if (filters?.platform && filters.platform !== "all") p.set("platform", filters.platform);
      p.set("page_size", "1000");
      return apiFetch<{ contacts: Contact[] }>(`/contacts?${p}`).then((r) => r.contacts);
    },
  });
}
