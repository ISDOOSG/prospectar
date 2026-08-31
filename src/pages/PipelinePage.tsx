import { useContacts } from "@/hooks/useContacts";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Phone, Mail } from "lucide-react";
import type { Contact, ContactStatus } from "@/lib/types";

const COLS: { status: ContactStatus; label: string; color: string; bg: string }[] = [
  { status: "novo", label: "Novos", color: "bg-blue-500", bg: "bg-blue-500/5 border-blue-500/20" },
  { status: "contatado", label: "Contatados", color: "bg-yellow-500", bg: "bg-yellow-500/5 border-yellow-500/20" },
  { status: "qualificado", label: "Qualificados", color: "bg-green-500", bg: "bg-green-500/5 border-green-500/20" },
  { status: "descartado", label: "Descartados", color: "bg-red-500", bg: "bg-red-500/5 border-red-500/20" },
];

export default function PipelinePage() {
  const { data: contacts = [], isLoading } = useContacts();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const move = async (id: string, status: ContactStatus) => {
    await supabase.from("contacts").update({ status }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <p className="text-sm text-muted-foreground">Arraste seus contatos pelo funil de prospecção</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLS.map(col => {
          const items = contacts.filter(c => c.status === col.status);
          return (
            <div key={col.status} className={`rounded-lg border p-3 min-h-[300px] ${col.bg}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${col.color}`} />
                  <span className="font-semibold text-sm">{col.label}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
              </div>
              {items.slice(0, 30).map(c => {
                const cf = c.custom_fields || {};
                const initials = (c.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <Card key={c.id} className="mb-2">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={cf.profile_pic || ""} />
                          <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{cf.title || c.title || c.city || ""}</p>
                        </div>
                      </div>
                      <div className="flex gap-1 mt-2">
                        {COLS.filter(x => x.status !== col.status).map(x => (
                          <Button key={x.status} variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => move(c.id, x.status)}>
                            <div className={`h-1.5 w-1.5 rounded-full mr-1 ${x.color}`} />{x.label}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {items.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
