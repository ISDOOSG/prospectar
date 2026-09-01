import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/PlatformBadge";
import { ArrowLeft, Mail, Phone, MapPin, ExternalLink, MessageSquare, Loader2, Trash2, Copy, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Contact } from "@/lib/types";
import { useState } from "react";

export default function ContactDetailPage() {
  const { listId, contactId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEnriching, setIsEnriching] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", contactId],
    queryFn: () => apiFetch<Contact>(`/contacts/${contactId}`),
    enabled: !!contactId,
  });

  const handleDelete = async () => {
    await apiFetch(`/contacts/${contactId}`, { method: "DELETE" });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    toast({ title: "Contato removido" });
    navigate(`/lists/${listId}`);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  if (isLoading || !contact) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Carregando...</div>;
  }

  const cf = contact.custom_fields || {};
  const email = cf.email || contact.email;
  const profilePic = cf.profile_pic || cf.profile_pic_url || "";
  const initials = (contact.name || "?").split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();

  const socialLinks: { label: string; url: string; color: string }[] = [];
  if (contact.instagram) socialLinks.push({ label: `@${contact.instagram}`, url: `https://instagram.com/${contact.instagram}`, color: "text-pink-500" });
  if (contact.linkedin_url) socialLinks.push({ label: "LinkedIn", url: contact.linkedin_url, color: "text-blue-600" });
  if (cf.profile_url?.includes("x.com") || cf.profile_url?.includes("twitter")) socialLinks.push({ label: `@${cf.username || ""}`, url: cf.profile_url, color: "text-sky-500" });
  if (cf.profile_url?.includes("tiktok")) socialLinks.push({ label: `@${cf.username || ""}`, url: cf.profile_url, color: "text-fuchsia-500" });
  if (cf.channel_url) socialLinks.push({ label: "YouTube", url: cf.channel_url, color: "text-red-500" });
  if (cf.website && !socialLinks.some(l => l.url === cf.website)) socialLinks.push({ label: cf.website.replace(/https?:\/\/(www\.)?/, "").replace(/\/$/, ""), url: cf.website, color: "text-muted-foreground" });
  if (cf.source_url && !socialLinks.some(l => l.url === cf.source_url) && cf.source_url !== cf.website) socialLinks.push({ label: "Fonte original", url: cf.source_url, color: "text-amber-600" });

  const metaFields = Object.entries(cf).filter(
    ([k]) => !["email", "profile_pic", "profile_pic_url", "profile_url", "source_search_id", "linkedin", "instagram", "title"].includes(k)
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/lists/${listId}`)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
      </Button>

      {/* Header */}
      <div className="flex items-start gap-5">
        <Avatar className="h-20 w-20">
          <AvatarImage src={profilePic} />
          <AvatarFallback className="text-xl bg-primary/10 text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{contact.name || "Sem nome"}</h1>
          {(cf.title || contact.title) && <p className="text-muted-foreground">{cf.title || contact.title}</p>}
          {contact.company && <p className="text-sm text-muted-foreground">{contact.company}</p>}
          <div className="flex items-center gap-2 mt-2">
            <SourceBadge source={contact.source} />
            {contact.tags?.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={isEnriching} onClick={async () => {
            setIsEnriching(true);
            try {
              await apiFetch(`/contacts/${contact.id}/enrich`, { method: "POST" });
              queryClient.invalidateQueries({ queryKey: ["contact", contactId] });
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : "Erro ao enriquecer";
              toast({ title: "Erro", description: msg, variant: "destructive" });
            } finally { setIsEnriching(false); }
          }}>
            {isEnriching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4 text-amber-500" />}
            Enriquecer
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Contact info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Informações de Contato</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${email}`} className="hover:underline">{email}</a>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(email, "Email")}><Copy className="h-3 w-3" /></Button>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${contact.phone}`} className="hover:underline">{contact.phone}</a>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(contact.phone, "Telefone")}><Copy className="h-3 w-3" /></Button>
              </div>
            )}
            {contact.city && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{contact.city}</span>
              </div>
            )}
            {!email && !contact.phone && !contact.city && <p className="text-sm text-muted-foreground">Sem informações de contato</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Redes Sociais</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {socialLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-2 text-sm ${link.color} hover:opacity-80`}>
                <ExternalLink className="h-3.5 w-3.5" />
                {link.label}
              </a>
            ))}
            {socialLinks.length === 0 && <p className="text-sm text-muted-foreground">Sem redes sociais</p>}
          </CardContent>
        </Card>
      </div>

      {/* Custom fields / metadata */}
      {metaFields.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Dados Adicionais</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
              {metaFields.map(([key, value]) => {
                if (value === null || value === undefined || value === "") return null;
                const display = typeof value === "object" ? JSON.stringify(value) : String(value);
                if (display.length > 500) return null;
                return (
                  <div key={key} className="flex justify-between text-sm py-1 border-b border-border/50">
                    <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="font-medium text-right max-w-[60%] truncate">{display}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
