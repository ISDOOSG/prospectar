import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ContactList } from "@/lib/types";

export function useContactLists() {
  return useQuery({
    queryKey: ["contact_lists"],
    queryFn: () => apiFetch<ContactList[]>("/contact-lists"),
  });
}
