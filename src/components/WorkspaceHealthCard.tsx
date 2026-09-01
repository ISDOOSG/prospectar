import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2, RefreshCw, Activity } from "lucide-react";

interface HealthCheck {
  ok: boolean;
  detail?: string | null;
}

// Formato do /health/workspace do backend novo -- substitui o
// remix-health-check original, que checava schema/vault do Lovable
// (nao existem mais aqui). So dois checks fazem sentido agora.
interface HealthResponse {
  usable: boolean;
  checks: Record<string, HealthCheck>;
  integrations: Record<string, "configured" | "missing">;
  next_step: string;
}

const CHECK_LABELS: Record<string, string> = {
  has_admin: "Admin cadastrado",
  workspace_ready: "Workspace pronto (Apollo)",
};

const INTEGRATION_LABELS: Record<string, string> = {
  apollo: "Apollo",
  apify: "Apify",
  crustdata: "CrustData",
  tavily: "Tavily",
  pdl: "People Data Labs",
  evolution: "Evolution (WhatsApp)",
  resend: "Resend (Email)",
};

export function WorkspaceHealthCard() {
  const { data, isLoading, refetch, isFetching, error } = useQuery({
    queryKey: ["workspace-health"],
    queryFn: () => apiFetch<HealthResponse>("/health/workspace"),
    staleTime: 30_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" /> Status do workspace
          </CardTitle>
          <CardDescription>Verifica administração e integrações deste projeto.</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verificando…
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Não foi possível verificar o workspace
          </div>
        )}

        {data && (
          <>
            <div className="flex items-center gap-2">
              {data.usable ? (
                <Badge variant="outline" className="text-green-600 border-green-600/30 gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Operacional
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-600 border-amber-600/30 gap-1">
                  <AlertCircle className="h-3 w-3" /> Setup pendente
                </Badge>
              )}
              <p className="text-xs text-muted-foreground">{data.next_step}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(data.checks).map(([key, check]) => (
                <div
                  key={key}
                  className="flex items-start gap-2 p-2 rounded-md border bg-muted/30"
                >
                  {check.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{CHECK_LABELS[key] ?? key}</p>
                    {check.detail && (
                      <p className="text-[10px] text-muted-foreground truncate">{check.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Integrações</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.integrations).map(([svc, status]) => (
                  <Badge
                    key={svc}
                    variant="outline"
                    className={
                      status === "configured"
                        ? "text-green-600 border-green-600/30 gap-1 text-[10px]"
                        : "text-muted-foreground gap-1 text-[10px]"
                    }
                  >
                    {status === "configured" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <AlertCircle className="h-3 w-3" />
                    )}
                    {INTEGRATION_LABELS[svc] ?? svc}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
