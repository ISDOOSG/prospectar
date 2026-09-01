import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ContactsTable } from "@/components/ContactsTable";
import { SourceBadge, StatusBadge } from "@/components/PlatformBadge";
import { useContactLists } from "@/hooks/useContactLists";
import { useContactsByList } from "@/hooks/useContactsByList";
import { useSearchesByList } from "@/hooks/useSearchesByList";
import { useToast } from "@/hooks/use-toast";
import { Search, Users, Loader2, RotateCcw, Sparkles, Download, ArrowLeft, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Contact } from "@/lib/types";

export default function ListDetailPage() {
  const { listId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: lists } = useContactLists();
  const list = lists?.find((l) => l.id === listId);

  const { data: contactsData, isLoading: loadingContacts } = useContactsByList(listId, {
    search: searchFilter || undefined,
    status: statusFilter,
    page,
    pageSize,
  });
  const contacts = contactsData?.contacts ?? [];
  const totalContacts = contactsData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalContacts / pageSize));

  const { data: searches = [] } = useSearchesByList(listId);
  const activeSearches = searches.filter(s => s.status === "running" || s.status === "pending");
  // Última busca finalizada com relatório por fonte (mostra de onde veio / por que falhou).
  const lastReportedSearch = searches.find(
    s => (s.status === "completed" || s.status === "failed") && (s.source_reports?.length ?? 0) > 0,
  );

  const handleBulkEnrich = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    toast({ title: "Enriquecendo...", description: `${ids.length} contatos.` });
    Promise.allSettled(ids.map((id) => apiFetch(`/contacts/${id}/enrich`, { method: "POST" }))).then((results) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      const falhas = results.filter((r) => r.status === "rejected").length;
      if (falhas === results.length) {
        toast({ title: "Enriquecimento indisponível", description: "Integração externa ainda não portada.", variant: "destructive" });
      } else {
        toast({ title: "Enriquecido!", description: `${results.length - falhas} contatos atualizados.` });
      }
    });
    setSelectedIds(new Set());
  };

  const handleBulkStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    await apiFetch("/contacts/bulk-status", {
      method: "PATCH",
      body: JSON.stringify({ ids: Array.from(selectedIds), status }),
    });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    setSelectedIds(new Set());
    toast({ title: `${selectedIds.size} contatos → ${status}` });
  };

  const handleExport = async () => {
    // Fetch all contacts for export (not just current page)
    const allContacts = await apiFetch<{ contacts: Contact[] }>(`/contacts?list_id=${listId}&page_size=10000`)
      .then((r) => r.contacts)
      .catch(() => null);

    const exportData = allContacts ?? contacts;
    const fields = ["name", "phone", "email", "company", "city", "instagram", "linkedin_url", "source", "status"];
    const header = fields.join(",");
    const rows = exportData.map((c: any) => {
      const cf = c.custom_fields || {};
      return fields.map(f => {
        let val = f === "email" ? (cf.email || c.email || "") : c[f] || "";
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${list?.name || "lista"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    toast({ title: "Exportado!", description: `${exportData.length} contatos.` });
  };

  if (!list) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground gap-2"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{list.name}</h1>
          {list.description && <p className="text-sm text-muted-foreground mt-1">{list.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {totalContacts} contatos</span>
            <span>{searches.length} buscas</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={contacts.length === 0}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          <Button size="sm" onClick={() => navigate("/")}>
            <Search className="mr-2 h-4 w-4" /> Nova Busca
          </Button>
        </div>
      </div>

      {/* Active searches */}
      {activeSearches.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-2">
            {activeSearches.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span className="text-sm">{s.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <SourceBadge source={s.source} />
                  <StatusBadge status={s.status} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Relatório por fonte da última busca */}
      {lastReportedSearch && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Resultado por fonte — {lastReportedSearch.name}
              </p>
              <SourceBadge source={lastReportedSearch.source} />
            </div>
            <div className="space-y-1.5">
              {(lastReportedSearch.source_reports ?? []).map((r) => (
                <div key={r.source} className="flex items-start gap-2 text-xs">
                  {r.error ? (
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                  )}
                  <span className="font-mono text-muted-foreground shrink-0">{r.source}</span>
                  {r.error ? (
                    <span className="text-amber-600">{r.error}</span>
                  ) : (
                    <span className="text-muted-foreground">{r.found} resultado{r.found === 1 ? "" : "s"}</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchFilter} onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }} placeholder="Buscar por nome..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="novo">Novo</SelectItem>
            <SelectItem value="contatado">Contatado</SelectItem>
            <SelectItem value="qualificado">Qualificado</SelectItem>
            <SelectItem value="descartado">Descartado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2">
          <span className="text-sm font-medium">{selectedIds.size} selecionado{selectedIds.size > 1 ? "s" : ""}</span>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={handleBulkEnrich} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Enriquecer
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus("contatado")}>Contatado</Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus("qualificado")}>Qualificado</Button>
            <Button variant="outline" size="sm" onClick={() => handleBulkStatus("descartado")}>Descartar</Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
          </div>
        </div>
      )}

      {/* Table */}
      {loadingContacts ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <ContactsTable
          contacts={contacts}
          listId={listId!}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalContacts)} de {totalContacts} contatos
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(1)} className="text-xs px-2">
              1
            </Button>
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <span className="text-xs font-medium px-2 tabular-nums">
              {page} / {totalPages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="text-xs px-2">
              {totalPages}
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
