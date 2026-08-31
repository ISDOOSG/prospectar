import { useContacts } from "@/hooks/useContacts";
import { useLeadSearches } from "@/hooks/useLeadSearches";
import { useContactLists } from "@/hooks/useContactLists";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { SourceBadge } from "@/components/PlatformBadge";
import { Users, TrendingUp, Search, FolderKanban, Target } from "lucide-react";

export default function AnalyticsPage() {
  const { data: contacts = [] } = useContacts();
  const { data: searches = [] } = useLeadSearches();
  const { data: lists = [] } = useContactLists();

  const byStatus = contacts.reduce((a, c) => { a[c.status || "novo"] = (a[c.status || "novo"] || 0) + 1; return a; }, {} as Record<string, number>);
  const bySource = contacts.reduce((a, c) => { a[c.source || "?"] = (a[c.source || "?"] || 0) + 1; return a; }, {} as Record<string, number>);
  const withPhone = contacts.filter(c => c.phone).length;
  const withEmail = contacts.filter(c => c.custom_fields?.email).length;
  const avgScore = contacts.length ? Math.round(contacts.reduce((s, c) => s + (c.score || 0), 0) / contacts.length) : 0;

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const thisWeek = contacts.filter(c => new Date(c.created_at) > weekAgo).length;

  // Bar chart data (last 14 days)
  const dayMap: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); dayMap[d.toISOString().slice(0, 10)] = 0; }
  for (const c of contacts) { const day = c.created_at.slice(0, 10); if (day in dayMap) dayMap[day]++; }
  const maxDay = Math.max(...Object.values(dayMap), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">Métricas da sua prospecção</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Contatos" value={contacts.length} icon={Users} variant="primary" />
        <StatCard title="Esta Semana" value={thisWeek} icon={TrendingUp} variant="accent" />
        <StatCard title="Score Médio" value={`${avgScore}%`} icon={Target} />
        <StatCard title="Listas" value={lists.length} icon={FolderKanban} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Contatos / Dia (14 dias)</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {Object.entries(dayMap).map(([day, count]) => (
                <div key={day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors" style={{ height: `${(count / maxDay) * 100}%`, minHeight: count > 0 ? 4 : 0 }} title={`${day}: ${count}`} />
                  <span className="text-[8px] text-muted-foreground">{day.slice(8)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Por Status</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[{ k: "novo", l: "Novos", c: "bg-blue-500" }, { k: "contatado", l: "Contatados", c: "bg-yellow-500" }, { k: "qualificado", l: "Qualificados", c: "bg-green-500" }, { k: "descartado", l: "Descartados", c: "bg-red-500" }].map(s => {
              const n = byStatus[s.k] || 0;
              const p = contacts.length ? Math.round((n / contacts.length) * 100) : 0;
              return (
                <div key={s.k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="flex items-center gap-2"><div className={`h-2.5 w-2.5 rounded-full ${s.c}`} />{s.l}</span>
                    <span className="tabular-nums font-medium">{n} ({p}%)</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full"><div className={`h-full ${s.c} rounded-full`} style={{ width: `${p}%` }} /></div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Qualidade dos Dados</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[{ l: "Com Telefone", n: withPhone }, { l: "Com Email", n: withEmail }, { l: "Com Instagram", n: contacts.filter(c => c.instagram).length }, { l: "Com LinkedIn", n: contacts.filter(c => c.linkedin_url).length }].map(i => {
              const p = contacts.length ? Math.round((i.n / contacts.length) * 100) : 0;
              return (
                <div key={i.l} className="flex items-center justify-between text-sm">
                  <span>{i.l}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted rounded-full"><div className="h-full bg-primary rounded-full" style={{ width: `${p}%` }} /></div>
                    <span className="text-xs tabular-nums w-16 text-right">{i.n} ({p}%)</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Por Fonte</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(bySource).sort(([, a], [, b]) => b - a).slice(0, 8).map(([src, n]) => (
              <div key={src} className="flex items-center justify-between text-sm">
                <SourceBadge source={src as any} />
                <span className="tabular-nums font-medium">{n}</span>
              </div>
            ))}
            {Object.keys(bySource).length === 0 && <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
