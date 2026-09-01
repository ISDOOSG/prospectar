import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Contact } from "@/lib/types";

export function useContactsByList(listId: string | undefined, filters?: {
  search?: string; status?: string; source?: string; page?: number; pageSize?: number;
}) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;

  return useQuery({
    queryKey: ["contacts", { listId, ...filters }],
    queryFn: () => {
      const p = new URLSearchParams();
      p.set("list_id", listId!);
      p.set("page", String(page));
      p.set("page_size", String(pageSize));
      if (filters?.search) p.set("search", filters.search);
      if (filters?.status && filters.status !== "all") p.set("status", filters.status);
      if (filters?.source && filters.source !== "all") p.set("source", filters.source);
      return apiFetch<{ contacts: Contact[]; total: number; page: number; pageSize: number }>(`/contacts?${p}`);
    },
    enabled: !!listId,
  });
}
