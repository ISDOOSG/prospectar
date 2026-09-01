import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff, Smartphone, QrCode, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { useSaveSettings, useApiKeys, useSaveApiKey, type AppSettings } from "@/hooks/useSettings";

interface EvolutionSettingsProps {
  settings: AppSettings;
}

export default function EvolutionSettings({ settings }: EvolutionSettingsProps) {
  const { toast } = useToast();
  const saveSettings = useSaveSettings();
  const saveApiKey = useSaveApiKey();
  const { data: apiKeys } = useApiKeys();

  const [apiUrl, setApiUrl] = useState(settings.evolution_api_url || "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settingUp, setSettingUp] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string>(
    settings.evolution_connected ? "open" : "disconnected"
  );
  const [polling, setPolling] = useState(false);

  const evolutionStatus = apiKeys?.evolution;
  const isConfigured = !!evolutionStatus?.configured;
  const isConnected = connectionState === "open";

  const handleTest = async () => {
    if (!apiUrl.trim()) return;
    setTesting(true);
    try {
      const data = await apiFetch<{ valid: boolean; message: string }>("/evolution/test", {
        method: "POST",
        body: JSON.stringify({ evolution_api_url: apiUrl.trim(), evolution_api_key: apiKey.trim() || undefined }),
      });
      toast({
        title: data.valid ? "Conexão OK" : "Falha na conexão",
        description: data.message,
      });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao testar conexão";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSetup = async () => {
    if (!apiUrl.trim() || (!apiKey.trim() && !isConfigured)) {
      toast({ title: "Preencha URL e API Key", variant: "destructive" });
      return;
    }
    setSettingUp(true);
    try {
      // Save credentials: URL goes to settings, key goes to Vault
      await saveSettings.mutateAsync({
        evolution_api_url: apiUrl.trim(),
      } as any);

      if (apiKey.trim()) {
        await saveApiKey.mutateAsync({
          service_name: "evolution",
          api_key: apiKey.trim(),
          evolution_api_url: apiUrl.trim(),
        });
      }

      // Create instance and get QR
      const data = await apiFetch<{ qrcode: string | null; status: string }>("/evolution/setup", {
        method: "POST",
        body: JSON.stringify({ evolution_api_url: apiUrl.trim(), evolution_api_key: apiKey.trim() || undefined }),
      });

      if (data.qrcode) {
        setQrCode(data.qrcode);
        setConnectionState("connecting");
        setPolling(true);
      } else if (data.status === "open") {
        setConnectionState("open");
        toast({ title: "WhatsApp já está conectado!" });
      } else {
        toast({ title: "Instância criada", description: "Aguardando QR Code..." });
        refreshQr();
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro no setup";
      toast({ title: "Erro no setup", description: msg, variant: "destructive" });
    } finally {
      setSettingUp(false);
    }
  };

  const refreshQr = async () => {
    try {
      const data = await apiFetch<{ qrcode: string | null; status: string }>("/evolution/qrcode", { method: "POST" });
      if (data.qrcode) {
        setQrCode(data.qrcode);
        setConnectionState("connecting");
        setPolling(true);
      }
      if (data.status === "open") {
        setConnectionState("open");
        setPolling(false);
      }
    } catch (err) {
      console.error("QR refresh error:", err);
    }
  };

  const checkStatus = useCallback(async () => {
    try {
      const data = await apiFetch<{ connected: boolean }>("/evolution/status", { method: "POST" });
      if (data.connected) {
        setConnectionState("open");
        setPolling(false);
        setQrCode(null);
        toast({ title: "WhatsApp conectado com sucesso!" });
      }
    } catch (err) {
      console.error("Status check error:", err);
    }
  }, [toast]);

  // Poll for connection status when QR is shown
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [polling, checkStatus]);

  const handleDisconnect = async () => {
    try {
      await apiFetch("/evolution/disconnect", { method: "POST" });
      setConnectionState("disconnected");
      setQrCode(null);
      toast({ title: "WhatsApp desconectado" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erro ao desconectar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm">WhatsApp — Evolution API</CardTitle>
          {isConnected ? (
            <Badge variant="outline" className="text-[10px] text-green-600 border-green-600/20 gap-1">
              <Wifi className="h-3 w-3" /> Conectado
            </Badge>
          ) : isConfigured ? (
            <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-600/20 gap-1">
              <WifiOff className="h-3 w-3" /> Desconectado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
              <AlertCircle className="h-3 w-3" /> Não configurado
            </Badge>
          )}
        </div>
        <CardDescription>
          Configure sua instância Evolution API para disparar mensagens personalizadas via WhatsApp
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API URL */}
        <div className="space-y-1.5">
          <Label className="text-xs">URL da Evolution API</Label>
          <Input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://api.meudominio.com"
            className="font-mono text-xs"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <Label className="text-xs">API Key</Label>
          <div className="flex gap-2">
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type={showKey ? "text" : "password"}
              placeholder={isConfigured ? evolutionStatus?.masked_value || "****" : "Cole sua API Key..."}
              className="font-mono text-xs"
            />
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setShowKey(!showKey)}>
              {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !apiUrl.trim()}>
            {testing ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Testar Conexão
          </Button>
          <Button size="sm" onClick={handleSetup} disabled={settingUp || !apiUrl.trim() || (!apiKey.trim() && !isConfigured)}>
            {settingUp ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <QrCode className="h-3 w-3 mr-1" />}
            {isConfigured ? "Reconectar" : "Conectar WhatsApp"}
          </Button>
        </div>

        {/* QR Code Display */}
        {qrCode && !isConnected && (
          <>
            <Separator />
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="text-sm font-medium">Escaneie o QR Code com seu WhatsApp</p>
              <p className="text-xs text-muted-foreground">WhatsApp → Aparelhos conectados → Conectar aparelho</p>
              <div className="bg-white p-4 rounded-lg shadow-sm border">
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
              </div>
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Aguardando leitura do QR Code...</p>
              </div>
              <Button variant="ghost" size="sm" onClick={refreshQr}>
                <RefreshCw className="h-3 w-3 mr-1" /> Atualizar QR Code
              </Button>
            </div>
          </>
        )}

        {/* Connected State */}
        {isConnected && (
          <>
            <Separator />
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">WhatsApp conectado</p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    Instância: {settings.evolution_instance_name || "prospecta-ai"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleDisconnect} className="text-xs">
                Desconectar
              </Button>
            </div>
          </>
        )}

        {/* Info */}
        <p className="text-[10px] text-muted-foreground">
          A instância será criada automaticamente com as configurações: grupos ignorados, webhook para messages_upsert.
          A mesma instância pode ser compartilhada com outros produtos (SDR).
        </p>
      </CardContent>
    </Card>
  );
}
