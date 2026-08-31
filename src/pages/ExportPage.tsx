import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Download, Loader2 } from "lucide-react";
import { useContactLists } from "@/hooks/useContactLists";
import { useContactsByList } from "@/hooks/useContactsByList";
import { useContacts } from "@/hooks/useContacts";
import { useToast } from "@/hooks/use-toast";

export default function ExportPage() {
  const { data: lists = [] } = useContactLists();
  const { data: allContacts = [] } = useContacts();
  const [selectedList, setSelectedList] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();

  const { data: listData } = useContactsByList(selectedList === "all" ? undefined : selectedList, { pageSize: 5000 });
  const listContacts = listData?.contacts ?? [];
  const contacts = selectedList === "all" ? allContacts : listContacts;
  const filtered = statusFilter === "all" ? contacts : contacts.filter(c => c.status === statusFilter);

  const handleExport = () => {
    const fields = ["name", "phone", "email", "company", "title", "city", "instagram", "linkedin_url", "source", "status", "score"];
    const header = fields.join(",");
    const rows = filtered.map(c => {
      const cf = c.custom_fields || {};
      return fields.map(f => {
        let v = f === "email" ? (cf.email || c.email || "") : f === "title" ? (cf.title || c.title || "") : (c as any)[f] || "";
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(",");
    });
    const blob = new Blob(["\uFEFF" + [header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `prospectai_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    toast({ title: "Exportado!", description: `${filtered.length} contatos em CSV.` });
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Exportar</h1>
        <p className="text-sm text-muted-foreground">Exporte contatos em CSV</p>
      </div>
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Lista</Label>
            <Select value={selectedList} onValueChange={setSelectedList}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas ({allContacts.length})</SelectItem>
                {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name} ({l.contacts_count || 0})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="novo">Novos</SelectItem>
                <SelectItem value="contatado">Contatados</SelectItem>
                <SelectItem value="qualificado">Qualificados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">{filtered.length} contatos</span>
            <Button onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
