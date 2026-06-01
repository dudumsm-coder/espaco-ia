"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { engenhariaService } from "@/services/engenharia.service";
import { agentesService } from "@/services/agentes.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Bot, User, ArrowRight, CheckCircle, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const PHASE_LABELS: Record<ProjectStatus, string> = {
  iniciacao: "Iniciação",
  elicitacao: "Elicitação de Necessidades",
  analise: "Análise de Requisitos",
  validacao: "Validação",
  documentacao: "Documentação",
  baseline: "Baseline ✓",
};

const PHASE_DESC: Record<ProjectStatus, string> = {
  iniciacao: "Avance para iniciar a elicitação",
  elicitacao: "Converse com o Elicitador para capturar necessidades (mínimo 3)",
  analise: "Clique em Analisar para o Analisador gerar os requisitos formais",
  validacao: "Clique em Validar para o Validador avaliar a qualidade",
  documentacao: "Gere os artefatos: SRS, Matriz, Árvore, ICD",
  baseline: "Projeto concluído e aprovado",
};

interface Message { role: "user" | "assistant"; content: string; }

export default function ProjetoDetalhePage({ params }: { params: { id: string } }) {
  const projetoId = Number(params.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => engenhariaService.getProjeto(projetoId),
  });

  const { data: requisitos = [] } = useQuery({
    queryKey: ["requisitos", projetoId],
    queryFn: () => agentesService.listarRequisitos(projetoId),
    enabled: !!projeto && ["analise","validacao","documentacao","baseline"].includes(projeto.status),
  });

  const { data: artefatos = [] } = useQuery({
    queryKey: ["artefatos", projetoId],
    queryFn: () => agentesService.listarArtefatos(projetoId),
    enabled: !!projeto && ["documentacao","baseline"].includes(projeto.status),
  });

  const avancar = useMutation({
    mutationFn: () => engenhariaService.avancarFase(projetoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projeto", projetoId] }),
  });

  const analisar = useMutation({
    mutationFn: (feedback = "") => agentesService.analisar(projetoId, feedback),
    onSuccess: (res) => {
      setMessages(prev => [...prev, { role: "assistant", content: `**Análise concluída**\n\n${res.reply}\n\n${res.context.requisitos_count} requisitos gerados. Score geral: ${((res.context.score_geral as number) * 100).toFixed(0)}%` }]);
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["requisitos", projetoId] });
    },
  });

  const validar = useMutation({
    mutationFn: () => agentesService.validar(projetoId),
    onSuccess: (res) => {
      const ctx = res.context as Record<string, unknown>;
      const msg = ctx.aprovado
        ? `**Validação aprovada** ✓\n\nScore: ${((ctx.score_geral as number) * 100).toFixed(0)}%\n\n${res.reply}`
        : `**Reprovado — Ciclo ${ctx.ciclo}/${3}**\n\n${res.reply}\n\n**Feedback para análise:**\n${ctx.feedback}`;
      setMessages(prev => [...prev, { role: "assistant", content: msg }]);
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
      if (!ctx.aprovado && !ctx.max_ciclos_atingido) {
        analisar.mutate(ctx.feedback as string);
      }
    },
  });

  const gerarArtefato = useMutation({
    mutationFn: (tipo: "srs" | "matriz" | "arvore" | "icd") => agentesService.gerarArtefato(projetoId, tipo),
    onSuccess: (_, tipo) => {
      setMessages(prev => [...prev, { role: "assistant", content: `Artefato **${tipo.toUpperCase()}** gerado com sucesso.` }]);
      qc.invalidateQueries({ queryKey: ["artefatos", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
    },
  });

  const baseline = useMutation({
    mutationFn: () => agentesService.marcarBaseline(projetoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projeto", projetoId] }),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendElicitador = async () => {
    if (!input.trim() || loading) return;
    const content = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content }]);
    setLoading(true);
    try {
      const res = await agentesService.chatElicitador(projetoId, content);
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || !projeto) return <div className="text-muted-foreground">Carregando...</div>;

  const isElicitacao = projeto.status === "elicitacao" || projeto.status === "iniciacao";
  const isAnalise = projeto.status === "analise";
  const isValidacao = projeto.status === "validacao";
  const isDocumentacao = projeto.status === "documentacao";
  const isBaseline = projeto.status === "baseline";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{projeto.nome}</h1>
          {projeto.dominio && <p className="text-muted-foreground text-sm">{projeto.dominio}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
            {PHASE_LABELS[projeto.status]}
          </span>
          {!isBaseline && projeto.status === "elicitacao" && (
            <Button size="sm" onClick={() => avancar.mutate()} disabled={avancar.isPending}>
              <ArrowRight className="h-4 w-4 mr-1" /> Avançar
            </Button>
          )}
          {isDocumentacao && (
            <Button size="sm" variant="outline" onClick={() => baseline.mutate()} disabled={baseline.isPending}>
              <CheckCircle className="h-4 w-4 mr-1" /> Baseline
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{PHASE_DESC[projeto.status]}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {isElicitacao ? "Elicitador" : isAnalise ? "Analisador" : isValidacao ? "Validador" : isDocumentacao ? "Documentador" : "Histórico"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 overflow-y-auto space-y-3 mb-4">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
                    <Bot className="h-8 w-8 mb-2 text-primary/30" />
                    <p>{isElicitacao ? "Inicie a conversa com o Elicitador" : "Use os botões de ação ao lado"}</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white"><Bot className="h-3.5 w-3.5" /></div>}
                    <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>{msg.content}</div>
                    {msg.role === "user" && <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary"><User className="h-3.5 w-3.5" /></div>}
                  </div>
                ))}
                {(loading || analisar.isPending || validar.isPending || gerarArtefato.isPending) && (
                  <div className="flex gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white"><Loader2 className="h-3.5 w-3.5 animate-spin" /></div><div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground animate-pulse">Processando...</div></div>
                )}
                <div ref={bottomRef} />
              </div>

              {isElicitacao && (
                <div className="flex gap-2">
                  <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendElicitador()} placeholder="Responda ao Elicitador..." disabled={loading} />
                  <Button onClick={sendElicitador} disabled={loading || !input.trim()} size="icon"><Send className="h-4 w-4" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {isAnalise && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Analisador</CardTitle></CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => analisar.mutate()} disabled={analisar.isPending}>
                  {analisar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Analisar Requisitos
                </Button>
              </CardContent>
            </Card>
          )}

          {isValidacao && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Validador</CardTitle></CardHeader>
              <CardContent>
                <Button className="w-full" onClick={() => validar.mutate()} disabled={validar.isPending}>
                  {validar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Validar Requisitos
                </Button>
              </CardContent>
            </Card>
          )}

          {(isDocumentacao || isBaseline) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Documentador</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(["srs","matriz","arvore","icd"] as const).map(tipo => {
                  const gerado = (artefatos as Array<{tipo: string}>).some(a => a.tipo === tipo);
                  return (
                    <Button key={tipo} variant={gerado ? "outline" : "default"} size="sm" className="w-full justify-start" onClick={() => gerarArtefato.mutate(tipo)} disabled={gerarArtefato.isPending}>
                      <FileText className="h-3.5 w-3.5 mr-2" />
                      {gerado ? "✓ " : ""}{tipo.toUpperCase()}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {requisitos.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Requisitos ({(requisitos as unknown[]).length})</CardTitle></CardHeader>
              <CardContent className="max-h-64 overflow-y-auto space-y-2">
                {(requisitos as Array<{codigo: string; descricao: string; tipo: string; prioridade: string; score_qualidade: number}>).map(r => (
                  <div key={r.codigo} className="text-xs border rounded p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-primary">{r.codigo}</span>
                      <span className="text-muted-foreground">{r.tipo}</span>
                      {r.score_qualidade && <span className="ml-auto text-green-600">{(r.score_qualidade * 100).toFixed(0)}%</span>}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{r.descricao}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
