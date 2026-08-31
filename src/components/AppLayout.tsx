import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLeadSearches } from "@/hooks/useLeadSearches";
import { Badge } from "@/components/ui/badge";

const PAGE_TITLES: Record<string, string> = {
  "/search": "Nova Busca",
  "/lists": "Contatos",
  "/pipeline": "Pipeline",
  "/mensagens/compor": "Compor Mensagem",
  "/mensagens/enviados": "Enviados",
  "/mensagens/inbox": "Caixa de Entrada",
  "/mensagens/fila": "Fila de Envio",
  "/analytics": "Analytics",
  "/import": "Importar",
  "/export": "Exportar",
  "/settings": "Configurações",
};

function Breadcrumbs() {
  const location = useLocation();
  const params = useParams();
  const path = location.pathname;

  const { data: list } = useQuery({
    queryKey: ["contact_list", params.listId],
    queryFn: async () => {
      const { data } = await supabase.from("contact_lists").select("name").eq("id", params.listId!).single();
      return data;
    },
    enabled: !!params.listId,
  });

  if (path === "/") return <span className="text-sm font-semibold text-foreground">Dashboard</span>;

  const crumbs: { label: string; to?: string }[] = [];

  if (path.startsWith("/lists") && params.listId) {
    crumbs.push({ label: "Contatos", to: "/lists" });
    crumbs.push({ label: list?.name || "...", to: `/lists/${params.listId}` });
    if (params.contactId) crumbs.push({ label: "Detalhe" });
  } else {
    const title = PAGE_TITLES[path];
    if (title) crumbs.push({ label: title });
  }

  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          {crumb.to ? (
            <Link to={crumb.to} className="text-muted-foreground hover:text-foreground transition-colors">{crumb.label}</Link>
          ) : (
            <span className="font-semibold text-foreground">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

function ActiveSearchCount() {
  const { data: searches = [] } = useLeadSearches();
  const active = searches.filter(s => s.status === "running" || s.status === "pending");
  if (active.length === 0) return null;
  return (
    <Badge variant="outline" className="gap-1 text-[10px] bg-accent/10 text-accent border-accent/30 animate-pulse-soft">
      <div className="h-1.5 w-1.5 rounded-full bg-accent" />
      {active.length} busca{active.length > 1 ? "s" : ""} ativa{active.length > 1 ? "s" : ""}
    </Badge>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-bg-base">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border-subtle bg-bg-elevated px-6 shrink-0 gap-4">
            <SidebarTrigger />
            <Breadcrumbs />
            <div className="flex-1" />
            <ActiveSearchCount />
          </header>
          <main className="flex-1 overflow-auto">
            <div className="p-6 max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
