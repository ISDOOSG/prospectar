import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Users, FolderKanban, MoreVertical, Trash2, Loader2, Zap, Calendar } from "lucide-react";
import { useContactLists } from "@/hooks/useContactLists";
import { useLeadSearches } from "@/hooks/useLeadSearches";
import { useDeleteContactList } from "@/hooks/useDeleteContactList";
import { useToast } from "@/hooks/use-toast";

export default function ListsPage() {
  const [searchFilter, setSearchFilter] = useState("");
  const { data: lists = [], isLoading } = useContactLists();
  const { data: searches = [] } = useLeadSearches();
  const deleteMutation = useDeleteContactList();
  const navigate = useNavigate();
  const { toast } = useToast();

  const filtered = searchFilter
    ? lists.filter(l => l.name.toLowerCase().includes(searchFilter.toLowerCase()))
    : lists;

  const getListSearches = (listId: string) => searches.filter(s => s.target_list_id === listId);

  const handleDelete = (listId: string, listName: string) => {
    deleteMutation.mutate(listId, {
      onSuccess: () => toast({ title: "Lista removida" }),
      onError: (err) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando listas...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Minhas Listas</h1>
          <p className="text-sm text-muted-foreground">{lists.length} lista{lists.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => navigate("/")}>
          <Zap className="mr-2 h-4 w-4" /> Nova Busca
        </Button>
      </div>

      {lists.length > 3 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} placeholder="Filtrar listas..." className="pl-9" />
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FolderKanban className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {searchFilter ? "Nenhuma lista encontrada" : "Nenhuma lista ainda"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchFilter ? "Tente outro termo." : "Faça sua primeira busca para criar uma lista."}
            </p>
            {!searchFilter && (
              <Button onClick={() => navigate("/")}>
                <Zap className="mr-2 h-4 w-4" /> Fazer Primeira Busca
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(list => {
            const listSearches = getListSearches(list.id);
            const active = listSearches.filter(s => s.status === "running" || s.status === "pending");
            const lastSearch = listSearches[0];

            return (
              <Card
                key={list.id}
                className="cursor-pointer hover:border-primary/40 transition-colors group"
                onClick={() => navigate(`/lists/${list.id}`)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <FolderKanban className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{list.name}</h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" /> {list.contacts_count || 0} contatos
                        </span>
                        <span>{listSearches.length} buscas</span>
                        {lastSearch && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(lastSearch.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {active.length > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 animate-pulse-soft gap-1">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Buscando
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(list.id, list.name); }}>
                          <Trash2 className="mr-2 h-4 w-4" /> Deletar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
