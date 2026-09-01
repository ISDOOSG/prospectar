import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Contact, OutreachMessage, MessageDirection, MessageChannel, MessageStatus } from "@/lib/types";

// O backend novo devolve outreach_messages "cru" (sem join com contacts, sem
// filtro por direction/channel/status -- so por contact_id, e sem paginacao,
// so um limit 200 fixo). O join e o filtro que a Supabase fazia no servidor
// agora sao feitos aqui: o volume e pequeno (nenhum envio real esta ativo
// ainda, tudo que gera mensagem de verdade e 501 -- ver main.py) e nao
// compensa portar paginacao/filtro para o backend antes de existir volume.

export interface OutreachFilters {
  direction?: MessageDirection;
  channel?: MessageChannel;
  status?: MessageStatus;
  contactId?: string;
}

async function contatosPorId(): Promise<Map<string, Contact>> {
  const r = await apiFetch<{ contacts: Contact[] }>("/contacts?page_size=1000");
  return new Map(r.contacts.map((c) => [c.id, c]));
}

function comContato(msg: OutreachMessage, contatos: Map<string, Contact>): OutreachMessage {
  const c = msg.contact_id ? contatos.get(msg.contact_id) : undefined;
  return c ? { ...msg, contact: { name: c.name, phone: c.phone, email: c.email, company: c.company } } : msg;
}

export function useOutreachMessages(filters: OutreachFilters = {}) {
  const { direction, channel, status, contactId } = filters;
  return useQuery({
    queryKey: ["outreach_messages", filters],
    queryFn: async () => {
      const path = contactId ? `/outreach-messages?contact_id=${contactId}` : "/outreach-messages";
      const [msgs, contatos] = await Promise.all([apiFetch<OutreachMessage[]>(path), contatosPorId()]);
      const filtrados = msgs.filter((m) =>
        (!direction || m.direction === direction) &&
        (!channel || m.channel === channel) &&
        (!status || m.status === status)
      );
      const messages = filtrados.map((m) => comContato(m, contatos));
      return { messages, total: messages.length, page: 1, pageSize: messages.length };
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
      const [msgs, contatos] = await Promise.all([
        apiFetch<OutreachMessage[]>(`/outreach-messages?contact_id=${contactId}`),
        contatosPorId(),
      ]);
      return msgs
        .filter((m) => m.channel === "whatsapp")
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((m) => comContato(m, contatos));
    },
    enabled: !!contactId,
  });
}

export function useInboxConversations() {
  return useQuery({
    queryKey: ["inbox_conversations"],
    queryFn: async () => {
      const [msgs, contatos] = await Promise.all([
        apiFetch<OutreachMessage[]>("/outreach-messages"),
        contatosPorId(),
      ]);
      const inbound = msgs
        .filter((m) => m.direction === "inbound" && m.channel === "whatsapp")
        .sort((a, b) => b.created_at.localeCompare(a.created_at));

      const porContato = new Map<string, OutreachMessage>();
      for (const row of inbound) {
        const chave = row.contact_id || (row.metadata as Record<string, unknown> | null)?.phone as string || row.id;
        if (!porContato.has(chave)) porContato.set(chave, comContato(row, contatos));
      }
      return Array.from(porContato.values());
    },
  });
}

export function useOutreachStats() {
  return useQuery({
    queryKey: ["outreach_stats"],
    queryFn: async () => {
      const msgs = await apiFetch<OutreachMessage[]>("/outreach-messages");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isToday = (iso: string | null) => !!iso && new Date(iso) >= today;
      return {
        sent_today: msgs.filter((m) => m.direction === "outbound" && ["sent", "delivered", "read"].includes(m.status) && isToday(m.sent_at)).length,
        failed_today: msgs.filter((m) => m.direction === "outbound" && m.status === "failed" && isToday(m.sent_at)).length,
        inbox_total: msgs.filter((m) => m.direction === "inbound").length,
      };
    },
  });
}
