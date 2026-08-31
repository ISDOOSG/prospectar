import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Contact } from "@/lib/types";

export function useContacts(filters?: {
  search?: string;
  status?: string;
  platform?: string;
}) {
  return useQuery({
    queryKey: ["contacts", filters],
    queryFn: async () => {
      let query = supabase
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,company.ilike.%${filters.search}%`
        );
      }
      if (filters?.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters?.platform && filters.platform !== "all") {
        query = query.eq("platform", filters.platform);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });
}
