import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Inbox, Loader2, Send, MessageSquare, ArrowLeft, User } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useInboxConversations, useContactThread } from "@/hooks/useOutreachMessages";
import { useSettings, useApiKeys } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { OutreachMessage } from "@/lib/types";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function InboxPage() {
  const { data: settings } = useSettings();
  const { data: apiKeys } = useApiKeys();
  const { data: conversations, isLoading } = useInboxConversations();
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Sem canal realtime no backend novo -- poll periodico no lugar do
  // postgres_changes que a Supabase oferecia.
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["inbox_conversations"] });
      if (selectedContactId) {
        queryClient.invalidateQueries({ queryKey: ["outreach_thread", selectedContactId] });
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [queryClient, selectedContactId]);

  const evoConnected = settings?.evolution_connected;

  if (!apiKeys?.evolution?.configured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Caixa de Entrada</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mensagens recebidas via WhatsApp</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <Inbox className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Configure a Evolution API para receber mensagens</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Caixa de Entrada</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mensagens recebidas via WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          {evoConnected ? (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600/20 text-[10px]">
              <div className="h-1.5 w-1.5 rounded-full bg-green-600" /> Conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-destructive border-destructive/20 text-[10px]">
              Desconectado
            </Badge>
          )}
          {conversations && conversations.length > 0 && (
            <Badge variant="secondary" className="text-xs">{conversations.length} conversa{conversations.length !== 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Conversation list */}
        <Card className={`lg:col-span-1 ${selectedContactId ? "hidden lg:block" : ""}`}>
          <CardContent className="p-0 h-full">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !conversations || conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
                <Inbox className="h-10 w-10 text-muted-foreground/30" />
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem recebida</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Quando um contato responder no WhatsApp, a conversa aparecerá aqui</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full">
                <div className="divide-y">
                  {conversations.map((conv) => {
                    const contactName = conv.contact?.name || conv.metadata?.push_name || conv.metadata?.phone || "Desconhecido";
                    const isSelected = conv.contact_id === selectedContactId;
                    return (
                      <button
                        key={conv.id}
                        className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                        onClick={() => setSelectedContactId(conv.contact_id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                            <User className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">{contactName}</p>
                              <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(conv.sent_at)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.message_text}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Thread view */}
        <Card className={`lg:col-span-2 ${!selectedContactId ? "hidden lg:flex lg:items-center lg:justify-center" : ""}`}>
          {!selectedContactId ? (
            <div className="flex flex-col items-center gap-3 text-center px-6">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Selecione uma conversa para ver as mensagens</p>
            </div>
          ) : (
            <ThreadView
              contactId={selectedContactId}
              onBack={() => setSelectedContactId(null)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}

function ThreadView({ contactId, onBack }: { contactId: string; onBack: () => void }) {
  const { data: messages, isLoading } = useContactThread(contactId);
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const contactName = messages?.[0]?.contact?.name || "Contato";
  const contactPhone = messages?.[0]?.contact?.phone || messages?.[0]?.metadata?.phone || "";

  const handleReply = async () => {
    if (!replyText.trim() || !contactPhone) return;
    setSending(true);
    try {
      await apiFetch("/messages/whatsapp", {
        method: "POST",
        body: JSON.stringify({ action: "send_single", contacts: [{ contact_id: contactId, phone: contactPhone, text: replyText.trim() }] }),
      });
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["outreach_thread", contactId] });
      toast({ title: "Resposta enviada" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao responder";
      toast({ title: "Erro ao responder", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <CardContent className="p-0 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7 lg:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
          <User className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="text-sm font-medium">{contactName}</p>
          <p className="text-xs text-muted-foreground">{contactPhone}</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !messages || messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem nesta conversa</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                msg.direction === "outbound"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}>
                <p className="whitespace-pre-wrap">{msg.message_text}</p>
                <p className={`text-[10px] mt-1 ${
                  msg.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground"
                }`}>
                  {new Date(msg.sent_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  {msg.direction === "outbound" && msg.status === "delivered" && " ✓✓"}
                  {msg.direction === "outbound" && msg.status === "read" && " ✓✓"}
                  {msg.direction === "outbound" && msg.status === "sent" && " ✓"}
                  {msg.direction === "outbound" && msg.status === "failed" && " ✕"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reply box */}
      <div className="border-t px-4 py-3 flex gap-2 shrink-0">
        <Textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Digite sua resposta..."
          className="text-sm h-10 min-h-[40px] max-h-[120px] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleReply();
            }
          }}
        />
        <Button size="icon" disabled={!replyText.trim() || sending} onClick={handleReply} className="shrink-0 h-10 w-10">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </CardContent>
  );
}
