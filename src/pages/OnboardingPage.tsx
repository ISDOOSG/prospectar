import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Zap, ArrowRight, ArrowLeft, Check, Loader2, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  useSaveSettings,
  useTestKey,
  useSaveApiKey,
  useApiKeys,
  useOnboardingState,
  useMarkUserOnboarded,
} from "@/hooks/useSettings";
import { useToast } from "@/hooks/use-toast";
import { WaitingForAdminSetup } from "@/components/WaitingForAdminSetup";


const STEPS = ["Bem-vindo", "Apollo.io", "Abordagem", "Fontes Extras", "Preferências"];

function KeyField({ label, description, helpUrl, helpLabel, value, onChange, keyType, required, icon }: {
  label: string; description: string; helpUrl: string; helpLabel: string;
  value: string; onChange: (v: string) => void; keyType: string; required?: boolean; icon: string;
}) {
  const testKey = useTestKey();
  const [status, setStatus] = useState<"idle" | "testing" | "valid" | "invalid">("idle");
  const [warning, setWarning] = useState<string | null>(null);

  const handleTest = async () => {
    if (!value.trim()) return;
    setStatus("testing");
    setWarning(null);
    try {
      const result = await testKey.mutateAsync({ service_name: keyType, api_key: value.trim() });
      setStatus(result.valid ? "valid" : "invalid");
      setWarning(result.warning || null);
    } catch { setStatus("invalid"); }
  };

  return (
    <div className="space-y-2 p-4 rounded-lg border bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <Label className="text-sm font-medium">{label}</Label>
          {required && <Badge variant="outline" className="text-[9px] text-primary border-primary/30">Obrigatório</Badge>}
          {!required && <Badge variant="outline" className="text-[9px] text-muted-foreground">Opcional</Badge>}
        </div>
        {status === "valid" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
        {status === "invalid" && <AlertCircle className="h-5 w-5 text-red-500" />}
      </div>
      <p className="text-xs text-muted-foreground">{description}</p>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => { onChange(e.target.value); setStatus("idle"); }}
          placeholder="Cole sua API key aqui..." type="password" className="font-mono text-xs" />
        <Button variant="outline" size="sm" onClick={handleTest} disabled={!value.trim() || status === "testing"}>
          {status === "testing" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Testar"}
        </Button>
      </div>
      {warning && (
        <div className="flex items-start gap-2 p-2.5 rounded-md border border-amber-500/30 bg-amber-500/5">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-600 leading-snug">{warning}</p>
        </div>
      )}
      <a href={helpUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
        <ExternalLink className="h-3 w-3" /> {helpLabel}
      </a>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const saveSettings = useSaveSettings();
  const saveApiKey = useSaveApiKey();
  const markUserOnboarded = useMarkUserOnboarded();
  const { data: onboardingState, isLoading: stateLoading } = useOnboardingState();
  const { data: apiKeys } = useApiKeys();

  // Obrigatórias
  const [apolloKey, setApolloKey] = useState("");
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionKey, setEvolutionKey] = useState("");

  // Opcionais — Prospecção
  const [apifyKey, setApifyKey] = useState("");
  const [crustdataKey, setCrustdataKey] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [pdlKey, setPdlKey] = useState("");

  // Opcionais — Email
  const [resendKey, setResendKey] = useState("");
  const [resendFromEmail, setResendFromEmail] = useState("");
  const [resendFromName, setResendFromName] = useState("");

  // Preferências
  const [workspaceName, setWorkspaceName] = useState("ProspectAI");
  const [defaultCountry, setDefaultCountry] = useState("Brasil");
  const [defaultLanguage, setDefaultLanguage] = useState("pt");
  const [autoEnrich, setAutoEnrich] = useState(true);
  const [defaultVolume, setDefaultVolume] = useState("25");

  const [isSaving, setIsSaving] = useState(false);

  // Loading state
  if (stateLoading || !onboardingState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Non-admin: cannot configure Vault. Show waiting screen.
  if (!onboardingState.is_admin) {
    return <WaitingForAdminSetup />;
  }

  

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      const keyJobs: Array<Promise<unknown>> = [];
      if (apolloKey.trim()) keyJobs.push(saveApiKey.mutateAsync({ service_name: "apollo", api_key: apolloKey.trim() }));
      if (evolutionKey.trim() && evolutionUrl.trim()) {
        keyJobs.push(saveApiKey.mutateAsync({
          service_name: "evolution",
          api_key: evolutionKey.trim(),
          evolution_api_url: evolutionUrl.trim(),
        }));
      }
      if (apifyKey.trim()) keyJobs.push(saveApiKey.mutateAsync({ service_name: "apify", api_key: apifyKey.trim() }));
      if (crustdataKey.trim()) keyJobs.push(saveApiKey.mutateAsync({ service_name: "crustdata", api_key: crustdataKey.trim() }));
      if (tavilyKey.trim()) keyJobs.push(saveApiKey.mutateAsync({ service_name: "tavily", api_key: tavilyKey.trim() }));
      if (pdlKey.trim()) keyJobs.push(saveApiKey.mutateAsync({ service_name: "pdl", api_key: pdlKey.trim() }));
      if (resendKey.trim()) keyJobs.push(saveApiKey.mutateAsync({ service_name: "resend", api_key: resendKey.trim() }));

      const results = await Promise.allSettled(keyJobs);
      const failed = results.filter(r => r.status === "rejected");
      if (failed.length) {
        const msgs = failed.map((r: any) => r.reason?.message || "erro").join("; ");
        toast({ title: "Algumas chaves falharam", description: msgs, variant: "destructive" });
      }
      const warnings = results
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value?.warning)
        .filter(Boolean) as string[];
      for (const w of warnings) {
        toast({ title: "Atenção", description: w, duration: 12000 });
      }

      await saveSettings.mutateAsync({
        evolution_api_url: evolutionUrl.trim() || undefined,
        resend_from_email: resendFromEmail.trim() || undefined,
        resend_from_name: resendFromName.trim() || undefined,
        workspace_name: workspaceName.trim() || "ProspectAI",
        default_country: defaultCountry,
        default_language: defaultLanguage,
        auto_enrich: autoEnrich,
        default_volume: parseInt(defaultVolume) || 25,
      } as any);

      await markUserOnboarded.mutateAsync();
      toast({ title: "Configuração concluída!", description: "Bem-vindo ao painel." });
      queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
      queryClient.invalidateQueries({ queryKey: ["api-keys"] });
      navigate("/", { replace: true });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center">
              <Zap className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">ProspectAI</h1>
          <p className="text-sm text-muted-foreground mt-1">Prospecção B2C Inteligente</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">{STEPS[step]}</p>

        {/* ─── STEP 0: Welcome ─── */}
        {step === 0 && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <h2 className="text-xl font-semibold">Bem-vindo ao ProspectAI</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Configure suas integrações em 2 minutos. Todas são opcionais — você pode adicioná-las depois em Configurações.
              </p>
              <div className="grid grid-cols-3 gap-3 pt-4">
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl mb-1">🚀</p>
                  <p className="text-xs font-medium">Apollo.io</p>
                  <p className="text-[10px] text-muted-foreground">Opcional</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl mb-1">📱</p>
                  <p className="text-xs font-medium">WhatsApp</p>
                  <p className="text-[10px] text-muted-foreground">Opcional</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 text-center">
                  <p className="text-2xl mb-1">⚡</p>
                  <p className="text-xs font-medium">+6 fontes</p>
                  <p className="text-[10px] text-muted-foreground">Opcionais</p>
                </div>
              </div>
              <Button onClick={() => setStep(1)} size="lg" className="mt-4 gap-2">
                Começar <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* ─── STEP 1: Apollo (obrigatório) ─── */}
        {step === 1 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">🚀 Apollo.io — Prospecção</CardTitle>
                <CardDescription>Fonte principal de prospecção. 275M+ contatos com email e telefone verificados. Opcional — adicione depois se preferir.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {apiKeys?.apollo?.configured && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-green-600/20 bg-green-500/5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-green-700">Já configurado por outro admin do workspace</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{apiKeys.apollo.masked_value}</p>
                    </div>
                    <Badge variant="outline" className="text-[9px]">Pular ou substituir</Badge>
                  </div>
                )}
                <KeyField label="Apollo.io API Key" description="Busca pessoas por cargo, localização e empresa. Retorna email verificado." helpUrl="https://app.apollo.io/settings/integrations/api_keys" helpLabel="Criar em app.apollo.io → Settings → API Keys" value={apolloKey} onChange={setApolloKey} keyType="apollo" required={false} icon="🚀" />
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(0)}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Pular</Button>
                <Button onClick={() => setStep(2)}>Próximo <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 2: Evolution + Resend (abordagem) ─── */}
        {step === 2 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">📱 Abordagem — WhatsApp & Email</CardTitle>
                <CardDescription>Configure os canais para enviar a primeira mensagem aos prospects.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">WhatsApp (Evolution API)</p>
                <div className="space-y-2 p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📱</span>
                    <Label className="text-sm font-medium">Evolution API</Label>
                    <Badge variant="outline" className="text-[9px] text-primary border-primary/30">Obrigatório para disparo</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Conecta seu WhatsApp para enviar openers personalizados via IA.</p>
                  <div className="space-y-2">
                    <Input value={evolutionUrl} onChange={e => setEvolutionUrl(e.target.value)} placeholder="URL da Evolution (ex: https://evo.seuservidor.com)" className="text-xs" />
                    <Input value={evolutionKey} onChange={e => setEvolutionKey(e.target.value)} placeholder="API Key da Evolution" type="password" className="font-mono text-xs" />
                  </div>
                  <a href="https://doc.evolution-api.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> doc.evolution-api.com
                  </a>
                </div>

                <Separator />

                <p className="text-xs font-semibold uppercase text-muted-foreground">Email (Resend) — Opcional</p>
                <div className="space-y-2 p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📧</span>
                    <Label className="text-sm font-medium">Resend</Label>
                    <Badge variant="outline" className="text-[9px] text-muted-foreground">Opcional</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Envie emails personalizados como canal alternativo de abordagem.</p>
                  <Input value={resendKey} onChange={e => setResendKey(e.target.value)} placeholder="Resend API Key" type="password" className="font-mono text-xs" />
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={resendFromEmail} onChange={e => setResendFromEmail(e.target.value)} placeholder="Email remetente" className="text-xs" />
                    <Input value={resendFromName} onChange={e => setResendFromName(e.target.value)} placeholder="Nome remetente" className="text-xs" />
                  </div>
                  <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> resend.com → API Keys
                  </a>
                </div>
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(3)}>Pular</Button>
                <Button onClick={() => setStep(3)}>Próximo <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 3: Fontes extras (opcionais) ─── */}
        {step === 3 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">⚡ Fontes Adicionais (opcional)</CardTitle>
                <CardDescription>Cada fonte ativa traz mais dados. Pode configurar depois em Configurações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <KeyField label="Apify" description="Google Maps (telefone real), Instagram (@handle), Twitter, TikTok, LinkedIn scraping." helpUrl="https://console.apify.com/account#/integrations" helpLabel="console.apify.com → Integrations" value={apifyKey} onChange={setApifyKey} keyType="apify" icon="🤖" />
                <KeyField label="CrustData" description="LinkedIn profiles com foto, cargo e empresa." helpUrl="https://crustdata.com" helpLabel="crustdata.com → Dashboard" value={crustdataKey} onChange={setCrustdataKey} keyType="crustdata" icon="🔮" />
                <KeyField label="Tavily Search" description="Busca web inteligente — sites, diretórios, contatos em páginas." helpUrl="https://tavily.com" helpLabel="tavily.com → API Keys" value={tavilyKey} onChange={setTavilyKey} keyType="tavily" icon="🌐" />
                <KeyField label="People Data Labs" description="Email pessoal, celular, Facebook, gênero, skills — 2.4B perfis." helpUrl="https://www.peopledatalabs.com" helpLabel="peopledatalabs.com → API Keys" value={pdlKey} onChange={setPdlKey} keyType="pdl" icon="📊" />
              </CardContent>
            </Card>
            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(2)}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(4)}>Pular</Button>
                <Button onClick={() => setStep(4)}>Próximo <ArrowRight className="ml-2 h-4 w-4" /></Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STEP 4: Preferências ─── */}
        {step === 4 && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Preferências</CardTitle>
                <CardDescription>Tudo pode ser alterado depois em Configurações.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nome do Workspace</Label>
                    <Input value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} placeholder="ProspectAI" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">País Principal</Label>
                    <Select value={defaultCountry} onValueChange={setDefaultCountry}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Brasil">Brasil</SelectItem>
                        <SelectItem value="Estados Unidos">Estados Unidos</SelectItem>
                        <SelectItem value="Portugal">Portugal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Volume Padrão / Busca</Label>
                    <Select value={defaultVolume} onValueChange={setDefaultVolume}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 por fonte</SelectItem>
                        <SelectItem value="25">25 por fonte</SelectItem>
                        <SelectItem value="50">50 por fonte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Idioma</Label>
                    <Select value={defaultLanguage} onValueChange={setDefaultLanguage}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt">Português</SelectItem>
                        <SelectItem value="en">Inglês</SelectItem>
                        <SelectItem value="es">Espanhol</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Resumo</p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={apolloKey ? "gap-1" : "gap-1 bg-destructive"}>🚀 Apollo {apolloKey ? "✓" : "✗"}</Badge>
                  {evolutionKey && <Badge variant="secondary" className="gap-1">📱 WhatsApp ✓</Badge>}
                  {!evolutionKey && <Badge variant="outline" className="gap-1 text-muted-foreground">📱 WhatsApp —</Badge>}
                  {apifyKey && <Badge variant="secondary" className="gap-1">🤖 Apify ✓</Badge>}
                  {crustdataKey && <Badge variant="secondary" className="gap-1">🔮 CrustData ✓</Badge>}
                  {tavilyKey && <Badge variant="secondary" className="gap-1">🌐 Tavily ✓</Badge>}
                  {pdlKey && <Badge variant="secondary" className="gap-1">📊 PDL ✓</Badge>}
                  {resendKey && <Badge variant="secondary" className="gap-1">📧 Resend ✓</Badge>}
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(3)}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button>
              <Button onClick={handleFinish} disabled={isSaving || !apolloKey.trim()} size="lg" className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Finalizar Setup
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
