import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LeadSearch } from "@/lib/types";

export function useLeadSearches() {
  return useQuery({
    queryKey: ["lead_searches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_searches")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadSearch[];
    },
  });
}
