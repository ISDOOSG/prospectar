import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare, Send, Sparkles, Loader2, CheckCircle2, XCircle,
  Users, RefreshCw, ChevronRight, AlertCircle, Smartphone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useContactLists } from "@/hooks/useContactLists";
import { useContactsByList } from "@/hooks/useContactsByList";
import { useSettings, useApiKeys } from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import type { Contact } from "@/lib/types";

type OpenerResult = {
  contact_id: string;
  contact_name: string;
  openers: string[];
};

type OutreachContact = Contact & {
  selectedOpener?: string;
  sendStatus?: "pending" | "sending" | "sent" | "failed";
};

export default function AbordagemPage() {
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const { data: apiKeys } = useApiKeys();
  const { data: lists } = useContactLists();

  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [templateHint, setTemplateHint] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [openers, setOpeners] = useState<Record<string, string[]>>({});
  const [chosenOpeners, setChosenOpeners] = useState<Record<string, string>>({});
  const [generatingOpeners, setGeneratingOpeners] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResults, setSendResults] = useState<{ sent: number; failed: number } | null>(null);
  const [step, setStep] = useState<"select" | "review" | "results">("select");

  const { data: contactsData, isLoading: loadingContacts } = useContactsByList(selectedListId || undefined, { pageSize: 1000 });
  const contacts = contactsData?.contacts ?? [];

  const evoConnected = settings?.evolution_connected;
  const evoConfigured = !!apiKeys?.evolution?.configured;
  const resendConfigured = !!apiKeys?.resend?.configured;

  const eligibleContacts = (contacts || []).filter(c => {
    if (c.status === "contatado") return false;
    if (channel === "whatsapp") return c.phone && c.phone.trim() !== "";
    if (channel === "email") {
      const email = c.custom_fields?.email || c.email;
      return email && email.trim() !== "";
    }
    return false;
  });

  const toggleContact = (id: string) => {
    const next = new Set(selectedContacts);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedContacts(next);
  };

  const toggleAll = () => {
    if (selectedContacts.size === eligibleContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(eligibleContacts.map(c => c.id)));
    }
  };

  const handleGenerateOpeners = async () => {
    if (selectedContacts.size === 0) return;
    setGeneratingOpeners(true);

    try {
      const selectedList = eligibleContacts.filter(c => selectedContacts.has(c.id));
      const { data, error } = await supabase.functions.invoke("generate-opener", {
        body: { contacts: selectedList, template_hint: templateHint },
      });
      if (error) throw error;

      const newOpeners: Record<string, string[]> = {};
      const newChosen: Record<string, string> = {};
      for (const r of data.results || []) {
        newOpeners[r.contact_id] = r.openers;
        if (r.openers.length > 0) newChosen[r.contact_id] = r.openers[0];
      }
      setOpeners(newOpeners);
      setChosenOpeners(newChosen);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Erro ao gerar openers", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingOpeners(false);
    }
  };

  const handleSendAll = async () => {
    setSending(true);
    setSendResults(null);

    try {
      const payload = eligibleContacts
        .filter(c => selectedContacts.has(c.id) && chosenOpeners[c.id])
        .map(c => ({
          contact_id: c.id,
          phone: c.phone,
          email: c.custom_fields?.email || c.email || "",
          text: chosenOpeners[c.id],
        }));

      if (payload.length === 0) {
        toast({ title: "Nenhum contato com mensagem selecionada", variant: "destructive" });
        return;
      }

      let data: any;
      if (channel === "whatsapp") {
        const resp = await supabase.functions.invoke("whatsapp-send", {
          body: { action: "send_bulk", contacts: payload },
        });
        if (resp.error) throw resp.error;
        data = resp.data;
      } else {
        const resp = await supabase.functions.invoke("email-send", {
          body: {
            action: "send_bulk",
            contacts: payload,
            subject: emailSubject || "Olá!",
            from_name: settings?.resend_from_name || settings?.workspace_name || "ProspectAI",
            from_email: settings?.resend_from_email || undefined,
          },
        });
        if (resp.error) throw resp.error;
        data = resp.data;
      }

      setSendResults({ sent: data.sent, failed: data.failed });
      setStep("results");
      toast({
        title: `Abordagem concluída`,
        description: `${data.sent} ${channel === "whatsapp" ? "mensagens" : "emails"} enviados, ${data.failed} falharam`,
      });
    } catch (err: any) {
      toast({ title: "Erro no disparo", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleSendSingle = async (contact: Contact) => {
    const text = chosenOpeners[contact.id];
    if (!text) return;

    try {
      if (channel === "whatsapp") {
        if (!contact.phone) return;
        const { error } = await supabase.functions.invoke("whatsapp-send", {
          body: { action: "send_single", contacts: [{ contact_id: contact.id, phone: contact.phone, text }] },
        });
        if (error) throw error;
      } else {
        const email = contact.custom_fields?.email || contact.email;
        if (!email) return;
        const { error } = await supabase.functions.invoke("email-send", {
          body: {
            action: "send_single",
            contacts: [{ contact_id: contact.id, email, text }],
            subject: emailSubject || "Olá!",
            from_name: settings?.resend_from_name || settings?.workspace_name || "ProspectAI",
            from_email: settings?.resend_from_email || undefined,
          },
        });
        if (error) throw error;
      }
      toast({ title: `${channel === "whatsapp" ? "Mensagem" : "Email"} enviado para ${contact.name}` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  // Check if channel is configured
  const channelConfigured = channel === "whatsapp" ? evoConfigured : resendConfigured;
  const channelConnected = channel === "whatsapp" ? evoConnected : resendConfigured;

  // Check if at least one channel is configured
  if (!evoConfigured && !resendConfigured) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold">Abordagem</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Primeira mensagem personalizada via WhatsApp ou Email</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center py-12 gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
            <div className="text-center">
              <p className="font-medium">Nenhum canal de abordagem configurado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Configure a Evolution API (WhatsApp) ou Resend (Email) nas Configurações.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.location.href = "/settings"}>
              <Smartphone className="h-4 w-4 mr-2" /> Ir para Configurações
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Abordagem</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Primeira mensagem personalizada via {channel === "whatsapp" ? "WhatsApp" : "Email"}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Channel selector */}
          <div className="flex rounded-lg border overflow-hidden">
            {evoConfigured && (
              <button onClick={() => { setChannel("whatsapp"); setSelectedContacts(new Set()); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${channel === "whatsapp" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                📱 WhatsApp
              </button>
            )}
            {resendConfigured && (
              <button onClick={() => { setChannel("email"); setSelectedContacts(new Set()); }}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${channel === "email" ? "bg-blue-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                📧 Email
              </button>
            )}
          </div>
          {evoConnected ? (
            <Badge variant="outline" className="gap-1 text-green-600 border-green-600/20">
              <CheckCircle2 className="h-3 w-3" /> WhatsApp conectado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-destructive border-destructive/20">
              <XCircle className="h-3 w-3" /> WhatsApp desconectado
            </Badge>
          )}
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs">
        <StepBadge active={step === "select"} done={step !== "select"} label="1. Selecionar" />
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <StepBadge active={step === "review"} done={step === "results"} label="2. Revisar Openers" />
        <ChevronRight className="h-3 w-3 text-muted-foreground" />
        <StepBadge active={step === "results"} done={false} label="3. Resultado" />
      </div>

      {/* ── STEP 1: SELECT CONTACTS ── */}
      {step === "select" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" /> Selecionar Contatos
              </CardTitle>
              <CardDescription>Escolha uma lista e selecione os contatos para abordagem</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Lista de Contatos</label>
                  <Select value={selectedListId} onValueChange={(v) => { setSelectedListId(v); setSelectedContacts(new Set()); }}>
                    <SelectTrigger><SelectValue placeholder="Selecione uma lista..." /></SelectTrigger>
                    <SelectContent>
                      {(lists || []).map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.name} ({l.contacts_count})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Contexto / Template (opcional)</label>
                  <Textarea
                    value={templateHint}
                    onChange={(e) => setTemplateHint(e.target.value)}
                    placeholder="Ex: Somos uma agência de marketing digital. Oferecer auditoria gratuita do perfil..."
                    className="text-xs h-20 resize-none"
                  />
                </div>
              </div>
              {channel === "email" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">Assunto do Email</label>
                  <input
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Ex: Uma oportunidade para sua clínica"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {loadingContacts && selectedListId && (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando contatos...
                </div>
              )}

              {selectedListId && !loadingContacts && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedContacts.size === eligibleContacts.length && eligibleContacts.length > 0}
                        onCheckedChange={toggleAll}
                      />
                      <span className="text-xs text-muted-foreground">
                        {selectedContacts.size} de {eligibleContacts.length} selecionados
                        {contacts && contacts.length > eligibleContacts.length && (
                          <span className="text-muted-foreground/60"> ({contacts.length - eligibleContacts.length} sem telefone ou já contatados)</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-1">
                      {eligibleContacts.map(c => (
                        <label key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer">
                          <Checkbox
                            checked={selectedContacts.has(c.id)}
                            onCheckedChange={() => toggleContact(c.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {c.title || c.company || ""}{c.city ? ` • ${c.city}` : ""} • {c.phone}
                            </p>
                          </div>
                          {c.score > 0 && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">Score {c.score}</Badge>
                          )}
                        </label>
                      ))}
                      {eligibleContacts.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          Nenhum contato elegível (com telefone e status ≠ contatado)
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>

          <Button
            size="lg"
            className="w-full"
            disabled={selectedContacts.size === 0 || generatingOpeners || !evoConnected}
            onClick={handleGenerateOpeners}
          >
            {generatingOpeners ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Gerando openers com IA...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" /> Gerar Openers para {selectedContacts.size} contato(s)</>
            )}
          </Button>
        </div>
      )}

      {/* ── STEP 2: REVIEW OPENERS ── */}
      {step === "review" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" /> Revisar Mensagens
                  </CardTitle>
                  <CardDescription>{Object.keys(openers).length} openers gerados — revise e edite antes de enviar</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setStep("select")}>
                  ← Voltar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {eligibleContacts
                    .filter(c => selectedContacts.has(c.id) && openers[c.id])
                    .map(contact => (
                      <div key={contact.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{contact.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {contact.phone} • {contact.title || contact.company || contact.city}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendSingle(contact)}
                            disabled={!chosenOpeners[contact.id]}
                          >
                            <Send className="h-3 w-3 mr-1" /> Enviar
                          </Button>
                        </div>
                        <div className="space-y-1.5">
                          {(openers[contact.id] || []).map((opener, idx) => (
                            <label
                              key={idx}
                              className={`flex items-start gap-2 p-2 rounded-md cursor-pointer border text-xs transition-colors ${
                                chosenOpeners[contact.id] === opener
                                  ? "border-primary bg-primary/5"
                                  : "border-transparent hover:bg-muted/50"
                              }`}
                              onClick={() => setChosenOpeners(prev => ({ ...prev, [contact.id]: opener }))}
                            >
                              <div className={`mt-0.5 h-3 w-3 rounded-full border-2 shrink-0 ${
                                chosenOpeners[contact.id] === opener
                                  ? "border-primary bg-primary"
                                  : "border-muted-foreground/30"
                              }`} />
                              <span className="whitespace-pre-wrap">{opener}</span>
                            </label>
                          ))}
                        </div>
                        {/* Editable opener */}
                        <Textarea
                          value={chosenOpeners[contact.id] || ""}
                          onChange={(e) => setChosenOpeners(prev => ({ ...prev, [contact.id]: e.target.value }))}
                          className="text-xs h-16 resize-none"
                          placeholder="Edite a mensagem..."
                        />
                      </div>
                    ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep("select"); }} className="flex-1">
              ← Voltar
            </Button>
            <Button
              variant="outline"
              onClick={handleGenerateOpeners}
              disabled={generatingOpeners}
              className="gap-1"
            >
              <RefreshCw className="h-3 w-3" /> Regenerar
            </Button>
            <Button
              size="lg"
              className="flex-1"
              disabled={sending || Object.keys(chosenOpeners).length === 0}
              onClick={handleSendAll}
            >
              {sending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Disparar {Object.keys(chosenOpeners).length} mensagem(ns)</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: RESULTS ── */}
      {step === "results" && sendResults && (
        <Card>
          <CardContent className="flex flex-col items-center py-12 gap-4">
            <CheckCircle2 className="h-16 w-16 text-green-600" />
            <div className="text-center">
              <p className="text-xl font-semibold">Abordagem concluída!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {sendResults.sent} mensagens enviadas com sucesso
                {sendResults.failed > 0 && `, ${sendResults.failed} falharam`}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setStep("select"); setSendResults(null); setOpeners({}); setChosenOpeners({}); setSelectedContacts(new Set()); }}>
                Nova Abordagem
              </Button>
              <Button onClick={() => window.location.href = "/lists"}>
                Ver Contatos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepBadge({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${
      active ? "bg-primary text-primary-foreground" : done ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
    }`}>
      {label}
    </span>
  );
}
