import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { OutreachMessage, MessageDirection, MessageChannel, MessageStatus } from "@/lib/types";

export interface OutreachFilters {
  direction?: MessageDirection;
  channel?: MessageChannel;
  status?: MessageStatus;
  contactId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useOutreachMessages(filters: OutreachFilters = {}) {
  const { direction, channel, status, contactId, search, page = 1, pageSize = 25 } = filters;

  return useQuery({
    queryKey: ["outreach_messages", filters],
    queryFn: async () => {
      let query = supabase
        .from("outreach_messages")
        .select("*, contacts(name, phone, email, company)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (direction) query = query.eq("direction", direction);
      if (channel) query = query.eq("channel", channel);
      if (status) query = query.eq("status", status);
      if (contactId) query = query.eq("contact_id", contactId);

      const { data, error, count } = await query;
      if (error) throw error;

      const messages = (data ?? []).map((row: any) => ({
        ...row,
        contact: row.contacts ?? null,
      })) as OutreachMessage[];

      return { messages, total: count ?? 0, page, pageSize };
    },
  });
}

export function useSentMessages(channel?: MessageChannel) {
  return useOutreachMessages({ direction: "outbound", channel });
}

export function useInboxMessages() {
  return useOutreachMessages({ direction: "inbound", channel: "whatsapp" });
}

export function useQueuedMessages() {
  return useOutreachMessages({ status: "failed" });
}

export function useContactThread(contactId: string) {
  return useQuery({
    queryKey: ["outreach_thread", contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_messages")
        .select("*, contacts(name, phone, email, company)")
        .eq("contact_id", contactId)
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        ...row,
        contact: row.contacts ?? null,
      })) as OutreachMessage[];
    },
    enabled: !!contactId,
  });
}

export function useInboxConversations() {
  return useQuery({
    queryKey: ["inbox_conversations"],
    queryFn: async () => {
      // Get all inbound messages grouped by contact
      const { data, error } = await supabase
        .from("outreach_messages")
        .select("*, contacts(name, phone, email, company)")
        .eq("direction", "inbound")
        .eq("channel", "whatsapp")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by contact_id, keep latest message per contact
      const conversationMap = new Map<string, OutreachMessage>();
      for (const row of data ?? []) {
        const meta = row.metadata as Record<string, any> | null;
        const key = row.contact_id || meta?.phone || row.id;
        if (!conversationMap.has(key)) {
          conversationMap.set(key, {
            ...row,
            contact: (row as any).contacts ?? null,
          } as unknown as OutreachMessage);
        }
      }

      return Array.from(conversationMap.values());
    },
  });
}

export function useOutreachStats() {
  return useQuery({
    queryKey: ["outreach_stats"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const [sentToday, failedToday, inbox] = await Promise.all([
        supabase.from("outreach_messages").select("id", { count: "exact", head: true })
          .eq("direction", "outbound").in("status", ["sent", "delivered", "read"]).gte("sent_at", todayIso),
        supabase.from("outreach_messages").select("id", { count: "exact", head: true })
          .eq("direction", "outbound").eq("status", "failed").gte("sent_at", todayIso),
        supabase.from("outreach_messages").select("id", { count: "exact", head: true })
          .eq("direction", "inbound"),
      ]);

      return {
        sent_today: sentToday.count ?? 0,
        failed_today: failedToday.count ?? 0,
        inbox_total: inbox.count ?? 0,
      };
    },
  });
}
