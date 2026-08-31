import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeadSearch } from "@/lib/types";

export function useSearchesByList(listId: string | undefined) {
  return useQuery({
    queryKey: ["lead_searches", { listId }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_searches")
        .select("*")
        .eq("target_list_id", listId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadSearch[];
    },
    enabled: !!listId,
  });
}
