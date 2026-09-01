import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SourceBadge } from "@/components/PlatformBadge";
import { MessageSquare, Mail, Phone, ExternalLink, Copy, ChevronDown, Sparkles, Loader2 as Spinner } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Contact, ContactStatus } from "@/lib/types";
import { apiFetch } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_OPTIONS: { value: ContactStatus; label: string; color: string }[] = [
  { value: "novo", label: "Novo", color: "bg-blue-500" },
  { value: "contatado", label: "Contatado", color: "bg-yellow-500" },
  { value: "qualificado", label: "Qualificado", color: "bg-green-500" },
  { value: "descartado", label: "Descartado", color: "bg-red-500" },
];

function SocialIcons({ contact }: { contact: Contact }) {
  const icons: React.ReactNode[] = [];
  const cf = contact.custom_fields || {};

  if (contact.instagram) {
    icons.push(
      <Tooltip key="ig">
        <TooltipTrigger asChild>
          <a href={`https://instagram.com/${contact.instagram}`} target="_blank" rel="noopener noreferrer"
            className="text-pink-500 hover:text-pink-400 transition-colors" onClick={(e) => e.stopPropagation()}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          </a>
        </TooltipTrigger>
        <TooltipContent>@{contact.instagram}</TooltipContent>
      </Tooltip>
    );
  }

  if (contact.linkedin_url) {
    icons.push(
      <Tooltip key="li">
        <TooltipTrigger asChild>
          <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-500 transition-colors" onClick={(e) => e.stopPropagation()}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
          </a>
        </TooltipTrigger>
        <TooltipContent>LinkedIn</TooltipContent>
      </Tooltip>
    );
  }

  if (cf.username && (contact.tags?.includes("twitter") || cf.profile_url?.includes("x.com"))) {
    icons.push(
      <Tooltip key="tw">
        <TooltipTrigger asChild>
          <a href={cf.profile_url || `https://x.com/${cf.username}`} target="_blank" rel="noopener noreferrer"
            className="text-sky-500 hover:text-sky-400 transition-colors" onClick={(e) => e.stopPropagation()}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </a>
        </TooltipTrigger>
        <TooltipContent>@{cf.username}</TooltipContent>
      </Tooltip>
    );
  }

  if (cf.profile_url?.includes("tiktok")) {
    icons.push(
      <Tooltip key="tt">
        <TooltipTrigger asChild>
          <a href={cf.profile_url} target="_blank" rel="noopener noreferrer"
            className="text-fuchsia-500 hover:text-fuchsia-400 transition-colors" onClick={(e) => e.stopPropagation()}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
          </a>
        </TooltipTrigger>
        <TooltipContent>TikTok</TooltipContent>
      </Tooltip>
    );
  }

  if (cf.channel_url || cf.profile_url?.includes("youtube")) {
    icons.push(
      <Tooltip key="yt">
        <TooltipTrigger asChild>
          <a href={cf.channel_url || cf.profile_url} target="_blank" rel="noopener noreferrer"
            className="text-red-500 hover:text-red-400 transition-colors" onClick={(e) => e.stopPropagation()}>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
          </a>
        </TooltipTrigger>
        <TooltipContent>YouTube</TooltipContent>
      </Tooltip>
    );
  }

  return icons.length > 0 ? <div className="flex items-center gap-2">{icons}</div> : <span className="text-muted-foreground text-xs">—</span>;
}

function StatusDropdown({ contact }: { contact: Contact }) {
  const queryClient = useQueryClient();
  const current = STATUS_OPTIONS.find((s) => s.value === contact.status) || STATUS_OPTIONS[0];

  const updateStatus = async (newStatus: ContactStatus) => {
    await apiFetch(`/contacts/${contact.id}`, { method: "PATCH", body: JSON.stringify({ status: newStatus }) });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="sm" className="h-6 px-2 gap-1 text-xs">
          <div className={`h-2 w-2 rounded-full ${current.color}`} />
          {current.label}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUS_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.value} onClick={(e) => { e.stopPropagation(); updateStatus(opt.value); }}>
            <div className={`h-2 w-2 rounded-full mr-2 ${opt.color}`} />
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface ContactsTableProps {
  contacts: Contact[];
  listId: string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function ContactsTable({ contacts, listId, selectedIds = new Set(), onSelectionChange }: ContactsTableProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const allSelected = contacts.length > 0 && contacts.every((c) => selectedIds.has(c.id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(contacts.map((c) => c.id)));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!`, description: text });
  };

  const getInitials = (name: string) => name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const getProfilePic = (c: Contact) => c.custom_fields?.profile_pic || c.custom_fields?.profile_pic_url || "";

  if (contacts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Nenhum contato encontrado</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            {onSelectionChange && (
              <TableHead className="w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
            )}
            <TableHead className="w-12" />
            <TableHead>Nome</TableHead>
            <TableHead className="hidden md:table-cell">Profissão</TableHead>
            <TableHead className="hidden lg:table-cell">Cidade</TableHead>
            <TableHead>Dados</TableHead>
            <TableHead>Redes</TableHead>
            <TableHead className="hidden md:table-cell">Contato</TableHead>
            <TableHead className="hidden xl:table-cell">Fonte</TableHead>
            <TableHead className="hidden xl:table-cell w-8" />
            <TableHead className="hidden lg:table-cell">Score</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.map((contact) => {
            const cf = contact.custom_fields || {};
            const email = cf.email || contact.email;
            const phone = contact.phone;

            return (
              <TableRow
                key={contact.id}
                className="cursor-pointer hover:bg-muted/40 transition-colors"
                onClick={() => navigate(`/lists/${listId}/contacts/${contact.id}`)}
              >
                {onSelectionChange && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(contact.id)} onCheckedChange={() => toggleOne(contact.id)} />
                  </TableCell>
                )}
                <TableCell>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={getProfilePic(contact)} />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(contact.name || "?")}</AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium text-sm">{contact.name || "Sem nome"}</span>
                    {contact.company && <p className="text-xs text-muted-foreground">{contact.company}</p>}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {cf.title || contact.title || "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {contact.city || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Tooltip><TooltipTrigger><div className={`h-2 w-2 rounded-full ${phone ? "bg-green-500" : "bg-muted-foreground/20"}`} /></TooltipTrigger><TooltipContent>{phone ? `Tel: ${phone}` : "Sem telefone"}</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger><div className={`h-2 w-2 rounded-full ${email ? "bg-green-500" : "bg-muted-foreground/20"}`} /></TooltipTrigger><TooltipContent>{email ? `Email: ${email}` : "Sem email"}</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger><div className={`h-2 w-2 rounded-full ${contact.instagram ? "bg-green-500" : "bg-muted-foreground/20"}`} /></TooltipTrigger><TooltipContent>{contact.instagram ? `@${contact.instagram}` : "Sem Instagram"}</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger><div className={`h-2 w-2 rounded-full ${contact.linkedin_url ? "bg-green-500" : "bg-muted-foreground/20"}`} /></TooltipTrigger><TooltipContent>{contact.linkedin_url ? "LinkedIn" : "Sem LinkedIn"}</TooltipContent></Tooltip>
                  </div>
                </TableCell>
                <TableCell>
                  <SocialIcons contact={contact} />
                </TableCell>
                <TableCell className="hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    {email && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(email, "Email")}>
                            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{email}</TooltipContent>
                      </Tooltip>
                    )}
                    {phone && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(phone, "Telefone")}>
                            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{phone}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <SourceBadge source={contact.source} />
                </TableCell>
                <TableCell className="hidden xl:table-cell" onClick={(e) => e.stopPropagation()}>
                  {cf.source_url && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={cf.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Ver fonte original</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {(() => {
                    const score = contact.score || contact.custom_fields?.confidence || 0;
                    if (!score) return <span className="text-xs text-muted-foreground">—</span>;
                    const color = score >= 60 ? "bg-green-500" : score >= 30 ? "bg-yellow-500" : "bg-red-500";
                    return (
                      <div className="flex items-center gap-1.5">
                        <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{score}</span>
                      </div>
                    );
                  })()}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <StatusDropdown contact={contact} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {phone && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <a href={`https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá ${contact.name?.split(" ")[0] || ""}, tudo bem?`)}`}
                          target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                          </Button>
                        </a>
                      </TooltipTrigger>
                      <TooltipContent>Abrir WhatsApp</TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
