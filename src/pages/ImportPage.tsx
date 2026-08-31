import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, FileSpreadsheet, Check } from "lucide-react";
import { useContactLists } from "@/hooks/useContactLists";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const CONTACT_FIELDS = ["name", "phone", "email", "company", "title", "city", "instagram", "linkedin_url"];
const FIELD_LABELS: Record<string, string> = {
  name: "Nome", phone: "Telefone", email: "Email", company: "Empresa",
  title: "Profissão", city: "Cidade", instagram: "Instagram", linkedin_url: "LinkedIn",
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(/[,;\t]/).map(h => h.replace(/^"|"$/g, "").trim());
  const rows = lines.slice(1).map(line => {
    const cells: string[] = [];
    let current = ""; let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if ((char === "," || char === ";" || char === "\t") && !inQuotes) { cells.push(current.trim()); current = ""; }
      else { current += char; }
    }
    cells.push(current.trim());
    return cells;
  });
  return { headers, rows };
}

export default function ImportPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: lists = [] } = useContactLists();

  const [file, setFile] = useState<File | null>(null);
  const [csv, setCsv] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [targetListId, setTargetListId] = useState("");
  const [listName, setListName] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [imported, setImported] = useState(0);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setListName(f.name.replace(/\.\w+$/, ""));
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      setCsv(parsed);
      // Auto-map columns
      const autoMap: Record<string, string> = {};
      for (const h of parsed.headers) {
        const lower = h.toLowerCase();
        if (lower.includes("nome") || lower === "name") autoMap[h] = "name";
        else if (lower.includes("telefone") || lower.includes("phone") || lower.includes("cel")) autoMap[h] = "phone";
        else if (lower.includes("email") || lower.includes("e-mail")) autoMap[h] = "email";
        else if (lower.includes("empresa") || lower.includes("company")) autoMap[h] = "company";
        else if (lower.includes("profiss") || lower.includes("cargo") || lower.includes("title")) autoMap[h] = "title";
        else if (lower.includes("cidade") || lower.includes("city") || lower.includes("local")) autoMap[h] = "city";
        else if (lower.includes("instagram") || lower.includes("insta")) autoMap[h] = "instagram";
        else if (lower.includes("linkedin")) autoMap[h] = "linkedin_url";
      }
      setMapping(autoMap);
    };
    reader.readAsText(f);
  }, []);

  const handleImport = async () => {
    if (!csv || csv.rows.length === 0) return;
    setIsImporting(true);
    setImported(0);

    try {
      let listId = targetListId && targetListId !== "none" ? targetListId : null;
      if (!listId) {
        const { data: newList, error } = await supabase.from("contact_lists").insert({
          name: listName || file?.name || "Import", description: "Importado de CSV",
        }).select().single();
        if (error) throw error;
        listId = newList.id;
      }

      let count = 0;
      for (const row of csv.rows) {
        const contact: Record<string, any> = {};
        for (const [csvCol, field] of Object.entries(mapping)) {
          const idx = csv.headers.indexOf(csvCol);
          if (idx >= 0 && row[idx]) contact[field] = row[idx];
        }
        if (!contact.name) continue;

        await supabase.rpc("upsert_lead_contact", {
          p_name: contact.name || "",
          p_phone: contact.phone || "",
          p_company: contact.company || "",
          p_city: contact.city || "",
          p_tags: ["imported"],
          p_list_id: listId,
          p_custom_fields: {
            email: contact.email || "",
            title: contact.title || "",
            linkedin: contact.linkedin_url || "",
            instagram: contact.instagram || "",
          },
          p_score: 0,
          p_source: "apify_contact_scraper",
        });
        count++;
        setImported(count);
      }

      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["contact_lists"] });
      toast({ title: "Importado!", description: `${count} contatos importados.` });
      navigate(`/lists/${listId}`);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Contatos</h1>
        <p className="text-sm text-muted-foreground">Importe de um arquivo CSV</p>
      </div>

      {/* Upload */}
      {!csv ? (
        <Card>
          <CardContent className="p-8">
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg py-12 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium mb-1">Arraste um arquivo CSV ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground">CSV, TSV — separado por vírgula, ponto-e-vírgula ou tab</p>
              <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
            </label>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Column mapping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Mapear Colunas</CardTitle>
              <CardDescription>{csv.headers.length} colunas encontradas · {csv.rows.length} linhas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {csv.headers.map(h => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded truncate max-w-[120px]">{h}</span>
                    <span className="text-xs text-muted-foreground">→</span>
                    <Select value={mapping[h] || "skip"} onValueChange={v => setMapping(prev => ({ ...prev, [h]: v === "skip" ? "" : v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skip">Ignorar</SelectItem>
                        {CONTACT_FIELDS.map(f => <SelectItem key={f} value={f}>{FIELD_LABELS[f]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {mapping[h] && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Preview */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Preview (5 primeiras linhas)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>{csv.headers.map(h => <TableHead key={h} className="text-xs">{mapping[h] ? FIELD_LABELS[mapping[h]] : <span className="text-muted-foreground line-through">{h}</span>}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {csv.rows.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>{row.map((cell, j) => <TableCell key={j} className={`text-xs ${!mapping[csv.headers[j]] ? "text-muted-foreground" : ""}`}>{cell.slice(0, 50)}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Import options */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da lista</Label>
                  <Input value={listName} onChange={e => setListName(e.target.value)} placeholder="Nome da lista" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ou adicionar a lista existente</Label>
                  <Select value={targetListId} onValueChange={setTargetListId}>
                    <SelectTrigger><SelectValue placeholder="Nova lista" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Criar nova</SelectItem>
                      {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  {isImporting && <p className="text-sm text-muted-foreground">{imported} de {csv.rows.length} importados...</p>}
                  {!isImporting && <p className="text-sm text-muted-foreground">{csv.rows.length} contatos para importar</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setCsv(null); setFile(null); setMapping({}); }}>Cancelar</Button>
                  <Button onClick={handleImport} disabled={isImporting || !Object.values(mapping).includes("name")}>
                    {isImporting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</> : <><Upload className="mr-2 h-4 w-4" /> Importar</>}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
