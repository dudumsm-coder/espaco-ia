"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { engenhariaService } from "@/services/engenharia.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Bot, User, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const PHASE_LABELS: Record<ProjectStatus, string> = {
  iniciacao: "Iniciação",
  elicitacao: "Elicitação",
  analise: "Análise",
  validacao: "Validação",
  documentacao: "Documentação",
  baseline: "Baseline ✓",
};

interface Message { role: "user" | "assistant"; content: string; }

export default function ProjetoDetalhePage({ params }: { params: { id: string } }) {
  const projetoId = Number(params.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: projeto } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => engenhariaService.getProjeto(projetoId),
  });

  const avancar = useMutation({
    mutationFn: () => engenhariaService.avancarFase(projetoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projeto", projetoId] }),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content }]);
    setLoading(true);

    try {
      const res = await engenhariaService.chatElicitador(projetoId, content);
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao processar. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  if (!projeto) return <div className="text-muted-foreground">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">{projeto.nome}</h1>
          {projeto.dominio && <p className="text-muted-foreground text-sm">{projeto.dominio}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">
            Fase: <strong className="text-foreground">{PHASE_LABELS[projeto.status]}</strong>
          </span>
          {projeto.status !== "baseline" && (
            <Button size="sm" onClick={() => avancar.mutate()} disabled={avancar.isPending}>
              <ArrowRight className="h-4 w-4 mr-1" /> Avançar fase
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Agente: {PHASE_LABELS[projeto.status] || "Elicitador"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 overflow-y-auto space-y-3 mb-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                <Bot className="h-8 w-8 mb-2 text-primary/30" />
                <p>Inicie a conversa com o agente de {PHASE_LABELS[projeto.status]}</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>{msg.content}</div>
                {msg.role === "user" && (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ))}
            {loading && <p className="text-muted-foreground text-sm animate-pulse">Agente processando...</p>}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
              placeholder="Responda ao agente..."
              disabled={loading || projeto.status === "baseline"}
            />
            <Button onClick={send} disabled={loading || !input.trim() || projeto.status === "baseline"} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
