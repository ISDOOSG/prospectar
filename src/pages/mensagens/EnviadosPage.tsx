import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CheckCheck, Mail, MessageSquare, Loader2, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useSentMessages } from "@/hooks/useOutreachMessages";
import type { OutreachMessage, MessageChannel, MessageStatus } from "@/lib/types";

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  sent: { label: "Enviado", className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  delivered: { label: "Entregue", className: "bg-green-500/10 text-green-600 border-green-500/20" },
  read: { label: "Lido", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive border-destructive/20" },
  pending: { label: "Pendente", className: "bg-muted text-muted-foreground" },
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return <Badge variant="outline" className={`text-[10px] ${style.className}`}>{style.label}</Badge>;
}

function ChannelBadge({ channel }: { channel: string }) {
  if (channel === "whatsapp") {
    return <Badge variant="outline" className="text-[10px] gap-1 bg-green-500/10 text-green-600 border-green-500/20"><MessageSquare className="h-3 w-3" /> WhatsApp</Badge>;
  }
  return <Badge variant="outline" className="text-[10px] gap-1 bg-blue-500/10 text-blue-600 border-blue-500/20"><Mail className="h-3 w-3" /> Email</Badge>;
}

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

export default function EnviadosPage() {
  const [channelFilter, setChannelFilter] = useState<"all" | MessageChannel>("all");
  const [page, setPage] = useState(1);
  const [selectedMessage, setSelectedMessage] = useState<OutreachMessage | null>(null);

  const { data, isLoading } = useSentMessages(channelFilter === "all" ? undefined : channelFilter);
  const messages = data?.messages ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Enviados</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Histórico de mensagens e emails enviados</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            {total} mensagen{total !== 1 ? "s" : ""}
          </Badge>
        </div>
      </div>

      <Tabs value={channelFilter} onValueChange={(v) => { setChannelFilter(v as any); setPage(1); }}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2">
              <CheckCheck className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma mensagem enviada ainda</p>
              <p className="text-xs text-muted-foreground/60">Envie mensagens via Compor para vê-las aqui</p>
            </div>
          ) : (
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Contato</TableHead>
                    <TableHead className="w-[100px]">Canal</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="w-[90px]">Status</TableHead>
                    <TableHead className="w-[80px] text-right">Quando</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedMessage(msg)}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium truncate">{msg.contact?.name || "Desconhecido"}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {msg.channel === "whatsapp"
                              ? (msg.metadata?.resolved_phone || msg.contact?.phone || "—")
                              : (msg.metadata?.email_to || msg.contact?.email || "—")}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell><ChannelBadge channel={msg.channel} /></TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                          {msg.channel === "email" && msg.metadata?.subject && (
                            <span className="font-medium text-foreground">{msg.metadata.subject} — </span>
                          )}
                          {msg.message_text}
                        </p>
                      </TableCell>
                      <TableCell><StatusBadge status={msg.status} /></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{timeAgo(msg.sent_at)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedMessage(msg); }}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Página {page} de {totalPages} ({total} total)
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Message detail sheet */}
      <Sheet open={!!selectedMessage} onOpenChange={() => setSelectedMessage(null)}>
        <SheetContent className="sm:max-w-lg">
          {selectedMessage && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ChannelBadge channel={selectedMessage.channel} />
                  <StatusBadge status={selectedMessage.status} />
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Contato</p>
                  <p className="text-sm font-medium">{selectedMessage.contact?.name || "Desconhecido"}</p>
                  {selectedMessage.contact?.company && (
                    <p className="text-xs text-muted-foreground">{selectedMessage.contact.company}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Destinatário</p>
                  <p className="text-sm">
                    {selectedMessage.channel === "whatsapp"
                      ? (selectedMessage.metadata?.resolved_phone || "—")
                      : (selectedMessage.metadata?.email_to || "—")}
                  </p>
                </div>
                {selectedMessage.metadata?.subject && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Assunto</p>
                    <p className="text-sm">{selectedMessage.metadata.subject}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Mensagem</p>
                  <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
                    {selectedMessage.message_text}
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Enviado em</p>
                    <p className="text-xs">{new Date(selectedMessage.sent_at).toLocaleString("pt-BR")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Provedor</p>
                    <p className="text-xs capitalize">{selectedMessage.provider || "—"}</p>
                  </div>
                </div>
                {selectedMessage.metadata?.error && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-destructive mb-1">Erro</p>
                    <p className="text-xs text-destructive/80">{selectedMessage.metadata.error}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
