import { LayoutDashboard, Settings, Zap, Kanban, BarChart3, Download, Upload, Search, Users, Send, CheckCheck, Inbox, Clock, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const sections = [
  {
    label: "Prospecção",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Nova Busca", url: "/search", icon: Search },
      { title: "Contatos", url: "/lists", icon: Users },
      { title: "Pipeline", url: "/pipeline", icon: Kanban },
    ],
  },
  {
    label: "Mensagens",
    items: [
      { title: "Compor", url: "/mensagens/compor", icon: Send },
      { title: "Enviados", url: "/mensagens/enviados", icon: CheckCheck },
      { title: "Caixa de Entrada", url: "/mensagens/inbox", icon: Inbox },
      { title: "Fila", url: "/mensagens/fila", icon: Clock },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { title: "Analytics", url: "/analytics", icon: BarChart3 },
      { title: "Importar", url: "/import", icon: Upload },
      { title: "Exportar", url: "/export", icon: Download },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Configurações", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <Sidebar collapsible="icon" className="bg-bg-darkest">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent shadow-accent-glow shrink-0">
            <Zap className="h-5 w-5 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-semibold text-text-on-dark tracking-tight">ProspectAI</h1>
              <p className="text-[11px] text-text-on-dark-muted">Prospecção B2C</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 py-3">
        {sections.map((section) => (
          <SidebarGroup key={section.label} className="py-1">
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-widest text-text-on-dark-muted/60 px-3 mb-1">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-text-on-dark-muted hover:text-text-on-dark hover:bg-sidebar-accent transition-all text-[13px] border-l-2 border-transparent"
                        activeClassName="!bg-accent/10 !text-accent !border-accent font-medium"
                      >
                        <item.icon className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent to-accent-hover flex items-center justify-center text-[10px] font-bold text-accent-foreground shrink-0 shadow-accent-glow">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-on-dark truncate">{user?.email ?? "Conta"}</p>
              <p className="text-[10px] text-text-on-dark-muted/60">ProspectAI v3</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Sair"
            className="p-1.5 rounded-md text-text-on-dark-muted hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
