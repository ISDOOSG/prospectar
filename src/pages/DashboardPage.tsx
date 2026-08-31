import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SourceBadge, StatusBadge } from "@/components/PlatformBadge";
import { useContacts } from "@/hooks/useContacts";
import { useLeadSearches } from "@/hooks/useLeadSearches";
import { useContactLists } from "@/hooks/useContactLists";
import { Users, TrendingUp, FolderKanban, Search, Loader2, ArrowRight, Zap, Phone, Mail, Target, Plus, Upload, BarChart3 } from "lucide-react";

function KpiCard({ label, value, subtitle, icon: Icon, trend }: {
  label: string; value: string | number; subtitle?: string; icon: any; trend?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-accent" />
            <span className="text-xs font-medium text-accent">{trend}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: contacts = [], isLoading } = useContacts();
  const { data: searches = [] } = useLeadSearches();
  const { data: lists = [] } = useContactLists();

  const activeSearches = searches.filter(s => s.status === "running" || s.status === "pending");
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = contacts.filter(c => new Date(c.created_at) > weekAgo).length;
  const withPhone = contacts.filter(c => c.phone).length;
  const withEmail = contacts.filter(c => c.custom_fields?.email).length;
  const enrichRate = contacts.length ? Math.round(((withPhone + withEmail) / (contacts.length * 2)) * 100) : 0;
  const completedSearches = searches.filter(s => s.status === "completed").length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral da sua prospecção B2C</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/import")}><Upload className="mr-2 h-4 w-4" /> Importar</Button>
          <Button onClick={() => navigate("/search")}><Search className="mr-2 h-4 w-4" /> Nova Busca</Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Contatos" value={contacts.length} icon={Users} subtitle={`${lists.length} listas`} />
        <KpiCard label="Esta Semana" value={thisWeek} icon={TrendingUp} subtitle="novos contatos" trend={thisWeek > 0 ? `+${thisWeek}` : undefined} />
        <KpiCard label="Enriquecimento" value={`${enrichRate}%`} icon={Target} subtitle={`${withPhone} tel · ${withEmail} email`} />
        <KpiCard label="Buscas" value={completedSearches} icon={Search} subtitle={`${activeSearches.length} ativa${activeSearches.length !== 1 ? "s" : ""}`} />
      </div>

      {/* Active searches */}
      {activeSearches.length > 0 && (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-primary">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Buscas em Execução
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeSearches.map(s => (
              <div key={s.id} className="space-y-2 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => s.target_list_id && navigate(`/lists/${s.target_list_id}`)}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <SourceBadge source={s.source} />
                    <StatusBadge status={s.status} />
                  </div>
                </div>
                <Progress value={s.status === "running" ? 55 : 15} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lists */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Suas Listas</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => navigate("/lists")} className="text-xs text-[hsl(var(--ring))] hover:text-[hsl(var(--ring))]">
                  Ver todas <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {lists.length === 0 ? (
                <div className="text-center py-10">
                  <FolderKanban className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Nenhuma lista ainda</p>
                  <Button size="sm" onClick={() => navigate("/search")}><Plus className="mr-2 h-3 w-3" /> Criar Primeira Lista</Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {lists.slice(0, 8).map(list => {
                    const active = searches.filter(s => s.target_list_id === list.id && (s.status === "running" || s.status === "pending"));
                    return (
                      <div key={list.id} className="flex items-center justify-between py-3 px-2 rounded hover:bg-muted/30 cursor-pointer transition-colors -mx-2"
                        onClick={() => navigate(`/lists/${list.id}`)}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <FolderKanban className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{list.name}</p>
                            <p className="text-xs text-muted-foreground">{list.contacts_count || 0} contatos</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {active.length > 0 && (
                            <Badge className="text-[10px] bg-primary/10 text-primary border-0 animate-pulse-soft">
                              <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" /> Buscando
                            </Badge>
                          )}
                          <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Ações Rápidas</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button className="h-auto py-3 flex-col gap-1.5 text-xs" variant="outline" onClick={() => navigate("/search")}>
                <Search className="h-5 w-5 text-primary" />Nova Busca
              </Button>
              <Button className="h-auto py-3 flex-col gap-1.5 text-xs" variant="outline" onClick={() => navigate("/import")}>
                <Upload className="h-5 w-5 text-primary" />Importar
              </Button>
              <Button className="h-auto py-3 flex-col gap-1.5 text-xs" variant="outline" onClick={() => navigate("/pipeline")}>
                <Zap className="h-5 w-5 text-primary" />Pipeline
              </Button>
              <Button className="h-auto py-3 flex-col gap-1.5 text-xs" variant="outline" onClick={() => navigate("/analytics")}>
                <BarChart3 className="h-5 w-5 text-primary" />Analytics
              </Button>
            </CardContent>
          </Card>

          {/* Data quality */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Qualidade dos Dados</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {contacts.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Faça uma busca para ver métricas</p>
              ) : (
                [
                  { label: "Telefone", icon: Phone, count: withPhone },
                  { label: "Email", icon: Mail, count: withEmail },
                  { label: "Instagram", icon: Users, count: contacts.filter(c => c.instagram).length },
                ].map(item => {
                  const pct = contacts.length ? Math.round((item.count / contacts.length) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className="flex items-center gap-1.5 text-muted-foreground"><item.icon className="h-3 w-3" /> {item.label}</span>
                        <span className="font-medium tabular-nums">{pct}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
