import { Loader2, ShieldAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

export function WaitingForAdminSetup() {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

  // Re-check workspace readiness every 15s so the agent unlocks automatically
  // once the admin finishes the setup wizard.
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-state"] });
    }, 15000);
    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full shadow-elevation-1 rounded-2xl">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
            <ShieldAlert className="h-6 w-6 text-accent" />
          </div>
          <CardTitle>Aguardando configuração do admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
          <p>
            O workspace ainda não foi configurado por um administrador. As integrações de
            prospecção (Apollo, enriquecimento, mensagens) precisam estar ativas antes que
            você possa usar a plataforma.
          </p>
          <div className="flex items-center justify-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Verificando automaticamente...
          </div>
          <Button variant="outline" size="sm" onClick={signOut} className="mt-4">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
