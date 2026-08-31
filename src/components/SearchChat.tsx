import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function SearchChat() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Descreva quem você quer encontrar e eu configuro a busca automaticamente.\n\nExemplo: *\"Dentistas em São Paulo que trabalham com estética dental\"*",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput("");

    const updated: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(updated);
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lead-search-ai-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: updated.map(m => ({ role: m.role, content: m.content })) }),
      });

      if (!response.ok) throw new Error(`Error: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      let assistantContent = "";
      let toolCalls: any[] = [];
      const decoder = new TextDecoder();

      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              assistantContent += delta.content;
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assistantContent };
                return copy;
              });
            }
            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.index !== undefined) {
                  if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: tc.id, function: { name: "", arguments: "" } };
                  if (tc.function?.name) toolCalls[tc.index].function.name = tc.function.name;
                  if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            }
          } catch {}
        }
      }

      // Execute tool calls
      for (const tc of toolCalls) {
        if (tc?.function?.name === "configure_search") {
          try {
            const args = JSON.parse(tc.function.arguments);
            await executeSearch(args);
          } catch {}
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: "Desculpe, ocorreu um erro. Tente novamente." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const executeSearch = async (args: any) => {
    try {
      const name = args.name || "Busca via IA";

      // Create list
      const { data: list, error: listErr } = await supabase.from("contact_lists").insert({
        name, description: "Criada via Chat IA",
      }).select().single();
      if (listErr) throw listErr;

      // Create search
      const { data: search, error } = await supabase.from("lead_searches").insert({
        name, source: args.source || "all", config: args.config || {}, status: "pending", target_list_id: list.id,
      }).select().single();
      if (error) throw error;

      toast({ title: "Busca criada!", description: `"${name}" em execução.` });
      queryClient.invalidateQueries({ queryKey: ["lead_searches", "contact_lists"] });

      supabase.functions.invoke("lead-search-execute", { body: { searchId: search.id } }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["lead_searches", "contacts", "contact_lists"] });
      });

      setMessages(prev => [...prev, { role: "assistant", content: `✅ Busca **"${name}"** criada! [Ver resultados →](/lists/${list.id})` }]);

      // Navigate after small delay
      setTimeout(() => navigate(`/lists/${list.id}`), 2000);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_a]:text-primary [&_a]:underline">
                  <ReactMarkdown>{msg.content || "..."}</ReactMarkdown>
                </div>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
            {msg.role === "user" && (
              <div className="h-7 w-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Descreva quem quer encontrar..."
            disabled={isLoading}
            className="h-10"
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()} size="icon" className="h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
