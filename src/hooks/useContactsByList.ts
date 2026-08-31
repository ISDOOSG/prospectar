import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contact } from "@/lib/types";

export function useContactsByList(listId: string | undefined, filters?: {
  search?: string;
  status?: string;
  source?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;

  return useQuery({
    queryKey: ["contacts", { listId, ...filters }],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*", { count: "exact" })
        .eq("list_id", listId!)
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,company.ilike.%${filters.search}%`);
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.source && filters.source !== "all") {
        query = query.eq("source", filters.source);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return {
        contacts: (data ?? []) as Contact[],
        total: count ?? 0,
        page,
        pageSize,
      };
    },
    enabled: !!listId,
  });
}
