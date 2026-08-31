import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, Loader2, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Mail, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueuedMessages } from "@/hooks/useOutreachMessages";
import { useSettings } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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

export default function FilaPage() {
  const { data, isLoading } = useQueuedMessages();
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  const messages = data?.messages ?? [];
  const total = data?.total ?? 0;

  const handleRetry = async (msg: any) => {
    setRetrying(prev => new Set(prev).add(msg.id));

    try {
      if (msg.channel === "whatsapp") {
        const phone = msg.metadata?.resolved_phone || msg.contact?.phone;
        if (!phone) throw new Error("Sem telefone para reenvio");

        const { error } = await supabase.functions.invoke("whatsapp-send", {
          body: {
            action: "send_single",
            contacts: [{
              contact_id: msg.contact_id,
              phone,
              text: msg.message_text,
            }],
          },
        });
        if (error) throw error;
      } else if (msg.channel === "email") {
        const email = msg.metadata?.email_to || msg.contact?.email;
        if (!email) throw new Error("Sem email para reenvio");

        const { error } = await supabase.functions.invoke("email-send", {
          body: {
            action: "send_single",
            contacts: [{
              contact_id: msg.contact_id,
              email,
              text: msg.message_text,
            }],
            subject: msg.metadata?.subject || "Olá!",
            from_name: settings?.resend_from_name || settings?.workspace_name || "ProspectAI",
            from_email: settings?.resend_from_email || undefined,
          },
        });
        if (error) throw error;
      }

      // Mark original as superseded (optional: just refetch)
      toast({ title: "Mensagem reenviada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["outreach_messages"] });
    } catch (err: any) {
      toast({ title: "Falha no reenvio", description: err.message, variant: "destructive" });
    } finally {
      setRetrying(prev => {
        const next = new Set(prev);
        next.delete(msg.id);
        return next;
      });
    }
  };

  const handleRetryAll = async () => {
    for (const msg of messages) {
      await handleRetry(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fila de Envio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Mensagens com falha que podem ser reenviadas</p>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <>
              <Badge variant="destructive" className="text-xs">
                {total} falha{total !== 1 ? "s" : ""}
              </Badge>
              <Button variant="outline" size="sm" onClick={handleRetryAll} className="gap-1">
                <RefreshCw className="h-3 w-3" /> Reenviar Todos
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <CheckCircle2 className="h-10 w-10 text-green-500/40" />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Nenhuma mensagem na fila</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Todas as mensagens foram enviadas com sucesso</p>
              </div>
            </div>
          ) : (
            <ScrollArea>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Contato</TableHead>
                    <TableHead className="w-[90px]">Canal</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="w-[200px]">Erro</TableHead>
                    <TableHead className="w-[70px]">Quando</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((msg) => (
                    <TableRow key={msg.id}>
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
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] gap-1 ${
                          msg.channel === "whatsapp"
                            ? "bg-green-500/10 text-green-600 border-green-500/20"
                            : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                        }`}>
                          {msg.channel === "whatsapp" ? <MessageSquare className="h-3 w-3" /> : <Mail className="h-3 w-3" />}
                          {msg.channel === "whatsapp" ? "WhatsApp" : "Email"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">{msg.message_text}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                          <p className="text-xs text-destructive truncate">{msg.metadata?.error || "Erro desconhecido"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(msg.sent_at)}</TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1 text-xs"
                          disabled={retrying.has(msg.id)}
                          onClick={() => handleRetry(msg)}
                        >
                          {retrying.has(msg.id) ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Reenviar
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
    </div>
  );
}
