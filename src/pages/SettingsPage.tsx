import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2, AlertCircle, Loader2, Save, ExternalLink, Eye, EyeOff, Mail, Trash2, RefreshCw } from "lucide-react";
import {
  useSettings, useSaveSettings, useTestKey, useApiKeys, useSaveApiKey,
  useDeleteApiKey, useResetUserOnboarding, useOnboardingState,
  type ApiKeyStatus,
} from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import EvolutionSettings from "@/components/EvolutionSettings";
import { WorkspaceHealthCard } from "@/components/WorkspaceHealthCard";

function ApiKeyRow({ label, icon, serviceName, status, helpUrl, helpLabel, onSave }: {
  label: string; icon: string; serviceName: string; status?: ApiKeyStatus; helpUrl: string; helpLabel: string; onSave: (serviceName: string, value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const testKey = useTestKey();
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);

  const configured = !!status?.configured;
  const maskedValue = status?.masked_value || "";

  const handleTest = async () => {
    if (!value.trim()) return;
    const result = await testKey.mutateAsync({ service_name: serviceName, api_key: value.trim() });
    setTestResult(result);
  };

  const handleSave = () => {
    onSave(serviceName, value.trim());
    setEditing(false);
    setValue("");
    setTestResult(null);
  };

  return (
    <div className="flex items-start justify-between p-4 rounded-lg border">
      <div className="space-y-1 flex-1">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <p className="font-medium text-sm">{label}</p>
          {configured ? (
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Conectado</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1"><AlertCircle className="h-3 w-3" /> Não configurado</Badge>
          )}
        </div>
        {configured && !editing && (
          <p className="text-xs font-mono text-muted-foreground">{maskedValue}</p>
        )}
        {editing && (
          <div className="space-y-2 mt-2">
            <div className="flex gap-2">
              <Input value={value} onChange={e => { setValue(e.target.value); setTestResult(null); }} type={showKey ? "text" : "password"} placeholder="Cole a nova key..." className="font-mono text-xs" />
              <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowKey(!showKey)}>{showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} disabled={!value.trim() || testKey.isPending}>
                {testKey.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Testar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!value.trim()}>
                <Save className="h-3 w-3 mr-1" /> Salvar
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setValue(""); setTestResult(null); }}>Cancelar</Button>
              {testResult && (
                <span className={`text-xs ${testResult.valid ? "text-green-600" : "text-red-500"}`}>{testResult.message}</span>
              )}
            </div>
          </div>
        )}
        <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-1">
          <ExternalLink className="h-2.5 w-2.5" /> {helpLabel}
        </a>
      </div>
      {!editing && (
        <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => setEditing(true)}>
          {configured ? "Alterar" : "Configurar"}
        </Button>
      )}
    </div>
  );
}

const SOURCES: { name: string; desc: string; requiredKey: string; dataTags: string[] }[] = [
  { name: "Apollo.io", desc: "275M+ contatos verificados — busca por cargo, localização, empresa", requiredKey: "apollo", dataTags: ["Email verificado", "Telefone", "Cargo", "Empresa", "LinkedIn"] },
  { name: "CrustData", desc: "LinkedIn profiles com nome, cargo, empresa, foto, localização", requiredKey: "crustdata", dataTags: ["LinkedIn Profiles", "Foto", "Cargo", "Empresa"] },
  { name: "Tavily Search", desc: "Busca web com extração de contatos de páginas", requiredKey: "tavily", dataTags: ["Web", "Sites pessoais", "Contatos"] },
  { name: "Apify (Instagram)", desc: "Busca perfis de profissionais no Instagram", requiredKey: "apify", dataTags: ["Instagram"] },
  { name: "Apify (LinkedIn)", desc: "Profissionais por cargo e localização", requiredKey: "apify", dataTags: ["LinkedIn"] },
  { name: "People Data Labs", desc: "1.5B perfis verificados com email e telefone", requiredKey: "pdl", dataTags: ["Email", "Telefone", "LinkedIn"] },
  { name: "Facebook Discovery", desc: "Agente autônomo: grupos, páginas, reviews, posts", requiredKey: "apify", dataTags: ["Grupos", "Páginas", "Reviews", "Posts"] },
  { name: "Contact Enrichment", desc: "Pipeline: IG Profile → Website → Tavily → CrustData", requiredKey: "tavily", dataTags: ["Enriquecimento"] },
];

function SourcesSection({ apiKeys }: { apiKeys: Record<string, ApiKeyStatus> | undefined }) {
  const keyConfigured: Record<string, boolean> = {
    apollo: !!apiKeys?.apollo?.configured,
    crustdata: !!apiKeys?.crustdata?.configured,
    tavily: !!apiKeys?.tavily?.configured,
    apify: !!apiKeys?.apify?.configured,
    pdl: !!apiKeys?.pdl?.configured,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Fontes de Dados</CardTitle>
        <CardDescription>Status das fontes baseado nas API keys configuradas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SOURCES.map(s => {
            const active = keyConfigured[s.requiredKey];
            return (
              <div key={s.name} className={`rounded-lg border p-3 space-y-1.5 ${!active ? "opacity-60" : ""}`}>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{s.name}</p>
                  {active ? (
                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/20 gap-1"><CheckCircle2 className="h-3 w-3" /> Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/20 gap-1"><AlertCircle className="h-3 w-3" /> Inativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {s.dataTags.map(tag => <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

const ALL_SERVICES = ["apollo", "apify", "crustdata", "tavily", "pdl", "evolution", "resend"];

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: apiKeys } = useApiKeys();
  const { data: onboardingState } = useOnboardingState();
  const saveSettings = useSaveSettings();
  const saveApiKey = useSaveApiKey();
  const deleteApiKey = useDeleteApiKey();
  const resetUserOnboarding = useResetUserOnboarding();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isWiping, setIsWiping] = useState(false);

  const handleSaveKey = (serviceName: string, value: string) => {
    saveApiKey.mutate({ service_name: serviceName, api_key: value }, {
      onSuccess: (data) => toast({ title: data?.valid ? "Key salva e validada!" : "Key salva", description: data?.message }),
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const handleSavePreference = (data: any) => {
    saveSettings.mutate(data, {
      onSuccess: () => toast({ title: "Preferência salva!" }),
    });
  };

  const handleReconfigure = async () => {
    try {
      await resetUserOnboarding.mutateAsync();
      navigate("/setup");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleWipeVault = async () => {
    setIsWiping(true);
    try {
      const results = await Promise.allSettled(ALL_SERVICES.map(s => deleteApiKey.mutateAsync(s)));
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed) {
        toast({ title: `${failed} chaves não removidas`, variant: "destructive" });
      } else {
        toast({ title: "Cofre esvaziado", description: "Todas as chaves foram removidas." });
      }
      await resetUserOnboarding.mutateAsync();
      navigate("/setup");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally { setIsWiping(false); }
  };

  if (isLoading || !settings) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const isAdmin = !!onboardingState?.is_admin;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">API keys, fontes de dados e preferências</p>
      </div>

      {isAdmin && <WorkspaceHealthCard />}

      {/* API Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">API Keys</CardTitle>
          <CardDescription>Configure as APIs para prospecção e enriquecimento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ApiKeyRow label="Apollo.io" icon="🚀" serviceName="apollo" status={apiKeys?.apollo} helpUrl="https://app.apollo.io/settings/integrations/api_keys" helpLabel="app.apollo.io → Settings → API Keys" onSave={handleSaveKey} />
          <ApiKeyRow label="CrustData" icon="🔮" serviceName="crustdata" status={apiKeys?.crustdata} helpUrl="https://crustdata.com" helpLabel="crustdata.com → Dashboard" onSave={handleSaveKey} />
          <ApiKeyRow label="Tavily Search" icon="🌐" serviceName="tavily" status={apiKeys?.tavily} helpUrl="https://tavily.com" helpLabel="tavily.com → API Keys" onSave={handleSaveKey} />
          <ApiKeyRow label="Apify" icon="🤖" serviceName="apify" status={apiKeys?.apify} helpUrl="https://console.apify.com/account#/integrations" helpLabel="console.apify.com → Integrations" onSave={handleSaveKey} />
          <ApiKeyRow label="People Data Labs" icon="📊" serviceName="pdl" status={apiKeys?.pdl} helpUrl="https://www.peopledatalabs.com" helpLabel="peopledatalabs.com → API Keys" onSave={handleSaveKey} />
        </CardContent>
      </Card>

      {/* Resend (Email) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Mail className="h-4 w-4" /> Email (Resend)</CardTitle>
          <CardDescription>Configure o envio de emails para abordagem de prospects</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ApiKeyRow label="Resend API Key" icon="📧" serviceName="resend" status={apiKeys?.resend} helpUrl="https://resend.com/api-keys" helpLabel="resend.com → API Keys" onSave={handleSaveKey} />
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Email remetente</Label>
              <Input defaultValue={settings.resend_from_email || ""} placeholder="contato@suaempresa.com" onBlur={e => handleSavePreference({ resend_from_email: e.target.value })} />
              <p className="text-[10px] text-muted-foreground">Domínio precisa ser verificado no Resend</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome remetente</Label>
              <Input defaultValue={settings.resend_from_name || ""} placeholder="João da Empresa X" onBlur={e => handleSavePreference({ resend_from_name: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evolution API / WhatsApp */}
      <EvolutionSettings settings={settings} />

      {/* Sources status */}
      <SourcesSection apiKeys={apiKeys} />

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Workspace</Label>
              <Input defaultValue={settings.workspace_name} onBlur={e => handleSavePreference({ workspace_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">País Padrão</Label>
              <Select defaultValue={settings.default_country || "Brasil"} onValueChange={v => handleSavePreference({ default_country: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Brasil">Brasil</SelectItem>
                  <SelectItem value="Estados Unidos">Estados Unidos</SelectItem>
                  <SelectItem value="Portugal">Portugal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Volume Padrão</Label>
              <Select defaultValue={String(settings.default_volume || 25)} onValueChange={v => handleSavePreference({ default_volume: parseInt(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <label className="flex items-center gap-3 cursor-pointer">
            <Switch checked={settings.auto_enrich} onCheckedChange={v => handleSavePreference({ auto_enrich: v })} />
            <div>
              <p className="text-sm font-medium">Auto-enriquecer contatos</p>
              <p className="text-xs text-muted-foreground">Busca email/telefone automaticamente após encontrar</p>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Reset wizard (per-user) */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium flex items-center gap-2"><RefreshCw className="h-4 w-4" /> Reconfigurar minha conta</p>
            <p className="text-xs text-muted-foreground">Abre o wizard novamente apenas para você. As chaves do workspace permanecem.</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleReconfigure} disabled={resetUserOnboarding.isPending}>
            {resetUserOnboarding.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Abrir Setup"}
          </Button>
        </CardContent>
      </Card>

      {/* Wipe Vault — admin only */}
      {isAdmin && (
        <Card className="border-destructive/30">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                <Trash2 className="h-4 w-4" /> Apagar todas as chaves do workspace
              </p>
              <p className="text-xs text-muted-foreground">
                Remove TODAS as API keys do cofre. Todos os usuários vão precisar refazer o setup.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isWiping}>
                  {isWiping ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                  Esvaziar cofre
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Apagar todas as chaves do workspace?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação remove permanentemente todas as API keys (Apollo, Apify, CrustData, Tavily, PDL, Evolution, Resend) do cofre.
                    Todos os usuários do workspace serão redirecionados para o wizard de setup novamente. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleWipeVault} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Apagar tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
