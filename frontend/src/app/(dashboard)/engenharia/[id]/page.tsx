"use client";
import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { engenhariaService } from "@/services/engenharia.service";
import { agentesService, AGENT_COSTS } from "@/services/agentes.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Bot, User, ArrowRight, CheckCircle, FileText, Loader2, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types";

const CATEGORIAS = ["contexto", "negocio", "usuarios", "restricoes", "sucesso"] as const;
const CATEGORIA_LABELS: Record<string, string> = {
  contexto: "Contexto", negocio: "Negócio", usuarios: "Usuários",
  restricoes: "Restrições", sucesso: "Sucesso",
};

const PHASE_LABELS: Record<ProjectStatus, string> = {
  iniciacao: "Iniciação", elicitacao: "Elicitação", re_elicitacao: "Esclarecimento",
  analise: "Análise", validacao: "Validação", documentacao: "Documentação", baseline: "Baseline ✓",
};

const PHASE_DESC: Record<ProjectStatus, string> = {
  iniciacao: "Clique em Iniciar para começar",
  elicitacao: "Responda às perguntas do consultor para descrever seu projeto (5 categorias)",
  re_elicitacao: "O sistema precisa de um esclarecimento antes de continuar",
  analise: "Clique em Analisar para transformar as necessidades em requisitos técnicos",
  validacao: "Clique em Validar para verificar a qualidade dos requisitos",
  documentacao: "Gere os documentos técnicos para sua equipe de desenvolvimento",
  baseline: "Projeto concluído — documentação pronta para entrega",
};

interface Message { role: "user" | "assistant"; content: string; isAlert?: boolean; }

export default function ProjetoDetalhePage({ params }: { params: { id: string } }) {
  const projetoId = Number(params.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data: projeto, isLoading } = useQuery({
    queryKey: ["projeto", projetoId],
    queryFn: () => engenhariaService.getProjeto(projetoId),
    refetchInterval: 5000,
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

  const invalidateCredits = () => qc.invalidateQueries({ queryKey: ["credits-balance"] });

  const analisar = useMutation({
    mutationFn: (feedback = "") => agentesService.analisar(projetoId, feedback),
    onSuccess: (res) => {
      const ctx = res.context as Record<string, unknown>;
      const creditMsg = `_(−${ctx.credits_used} créditos | saldo: ${ctx.credits_remaining})_`;
      setMessages(prev => [...prev, {
        role: "assistant",
        content: ctx.necessita_elicitacao
          ? res.reply
          : `**Análise concluída** — ${ctx.requisitos_count} requisitos. Score: ${((ctx.score_geral as number) * 100).toFixed(0)}%\n${creditMsg}\n\n${res.reply}`,
        isAlert: !!ctx.necessita_elicitacao,
      }]);
      invalidateCredits();
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
      qc.invalidateQueries({ queryKey: ["requisitos", projetoId] });
    },
  });

  const validar = useMutation({
    mutationFn: () => agentesService.validar(projetoId),
    onSuccess: (res) => {
      const ctx = res.context as Record<string, unknown>;
      const creditMsg = `_(−${ctx.credits_used} créditos | saldo: ${ctx.credits_remaining})_`;
      if (ctx.necessita_elicitacao) {
        setMessages(prev => [...prev, { role: "assistant", content: res.reply, isAlert: true }]);
        invalidateCredits();
        qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
        return;
      }
      if (ctx.deve_reanalisar) {
        setMessages(prev => [...prev, { role: "assistant", content: `**Ajustando requisitos** (ciclo ${ctx.ciclo}/3)...\n${creditMsg}\n\n${res.reply}` }]);
        analisar.mutate(ctx.feedback as string);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: (ctx.aprovado ? `**Aprovado ✓** Score: ${((ctx.score_geral as number)*100).toFixed(0)}%` : `**Validação concluída**`) + `\n${creditMsg}\n\n${res.reply}` }]);
      }
      invalidateCredits();
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
    },
  });

  const gerarArtefato = useMutation({
    mutationFn: (tipo: "srs" | "matriz" | "arvore" | "icd") => agentesService.gerarArtefato(projetoId, tipo),
    onSuccess: (res: Record<string, unknown>, tipo) => {
      setMessages(prev => [...prev, { role: "assistant", content: `Documento **${tipo.toUpperCase()}** gerado. _(−${res.credits_used} créditos | saldo: ${res.credits_remaining})_` }]);
      invalidateCredits();
      qc.invalidateQueries({ queryKey: ["artefatos", projetoId] });
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
    },
  });

  const baseline = useMutation({
    mutationFn: () => agentesService.marcarBaseline(projetoId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projeto", projetoId] }),
  });

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendChat = async () => {
    if (!input.trim() || chatLoading) return;
    const content = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content }]);
    setChatLoading(true);
    try {
      const res = await agentesService.chatElicitador(projetoId, content);
      const ctx = res.context as Record<string, unknown>;
      setMessages(prev => [...prev, { role: "assistant", content: res.reply }]);
      invalidateCredits();
      qc.invalidateQueries({ queryKey: ["projeto", projetoId] });
      void ctx;
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Erro. Tente novamente." }]);
    } finally {
      setChatLoading(false);
    }
  };

  const downloadMd = (tipo: string) => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/agentes/documentador/artefatos/${projetoId}/${tipo}/markdown`, "_blank");
  };

  if (isLoading || !projeto) return <div className="text-muted-foreground p-4">Carregando...</div>;

  const status = projeto.status as ProjectStatus;
  const projData = projeto as unknown as Record<string, unknown>;
  const categoriasConcluidas: string[] = (projData.categorias_concluidas as string[]) || [];
  const reMotivo = projData.re_elicitacao_motivo as string;
  const isChat = ["iniciacao","elicitacao","re_elicitacao"].includes(status);
  const isReElicitacao = status === "re_elicitacao";
  const isBusy = analisar.isPending || validar.isPending || gerarArtefato.isPending || chatLoading;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{projeto.nome}</h1>
          {projeto.dominio && <p className="text-muted-foreground text-sm">{projeto.dominio}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn("text-xs font-semibold px-3 py-1.5 rounded-full",
            isReElicitacao ? "bg-amber-100 text-amber-700" :
            status === "baseline" ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
          )}>
            {PHASE_LABELS[status]}
          </span>
          {status === "elicitacao" && (
            <Button size="sm" onClick={() => avancar.mutate()} disabled={avancar.isPending}>
              <ArrowRight className="h-3.5 w-3.5 mr-1" /> Ir para Análise
            </Button>
          )}
          {status === "documentacao" && (
            <Button size="sm" variant="outline" onClick={() => baseline.mutate()} disabled={baseline.isPending}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Concluir Projeto
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{PHASE_DESC[status]}</p>

      {/* Progresso categorias */}
      {status === "elicitacao" && (
        <div className="flex gap-2 flex-wrap">
          {CATEGORIAS.map(cat => {
            const done = categoriasConcluidas.includes(cat);
            return (
              <span key={cat} className={cn("text-xs px-2.5 py-1 rounded-full font-medium border transition-colors",
                done ? "bg-green-100 text-green-700 border-green-200" : "bg-muted text-muted-foreground border-transparent"
              )}>
                {done ? "✓ " : "○ "}{CATEGORIA_LABELS[cat]}
              </span>
            );
          })}
        </div>
      )}

      {/* Banner re-elicitação */}
      {isReElicitacao && reMotivo && (
        <div className="flex gap-3 items-start rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Precisamos de um esclarecimento</p>
            <p className="text-sm text-amber-700 mt-1">{reMotivo}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {isChat ? (isReElicitacao ? "Esclarecimento com o Consultor" : "Consultor de Negócios") :
                 status === "analise" ? "Analisador de Requisitos" :
                 status === "validacao" ? "Validador de Qualidade" :
                 "Documentador Técnico"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 overflow-y-auto space-y-3 mb-4 pr-1">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <Bot className="h-10 w-10 mb-3 text-primary/20" />
                    <p className="text-sm font-medium">
                      {isChat ? "Inicie respondendo à primeira pergunta do consultor" : "Use os botões ao lado"}
                    </p>
                    {status === "elicitacao" && (
                      <p className="text-xs mt-1 max-w-xs text-muted-foreground/70">
                        O consultor vai guiá-lo por 5 temas: Contexto, Negócio, Usuários, Restrições e Sucesso
                      </p>
                    )}
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                    {msg.role === "assistant" && (
                      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        msg.isAlert ? "bg-amber-500 text-white" : "bg-primary text-white"
                      )}>
                        {msg.isAlert ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                      </div>
                    )}
                    <div className={cn("max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                      msg.role === "user" ? "bg-primary text-primary-foreground" :
                      msg.isAlert ? "bg-amber-50 border border-amber-200 text-amber-900" : "bg-muted"
                    )}>
                      {msg.content}
                    </div>
                    {msg.role === "user" && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <User className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                ))}
                {isBusy && (
                  <div className="flex gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-white">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </div>
                    <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground animate-pulse">Processando...</div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              {isChat && (
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                    placeholder={isReElicitacao ? "Esclareça a questão levantada..." : "Responda ao consultor..."}
                    disabled={chatLoading}
                  />
                  <Button onClick={sendChat} disabled={chatLoading || !input.trim()} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Ações */}
        <div className="space-y-4">
          {status === "analise" && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Analisador</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Converte necessidades de negócio em requisitos técnicos formais</p>
                <Button className="w-full" onClick={() => analisar.mutate()} disabled={analisar.isPending}>
                  {analisar.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analisando...</> : <>Analisar Requisitos <span className="ml-auto text-xs opacity-70">−{AGENT_COSTS.analisador} créditos</span></>}
                </Button>
              </CardContent>
            </Card>
          )}

          {status === "validacao" && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Validador</CardTitle></CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">Verifica qualidade e completude dos requisitos técnicos</p>
                <Button className="w-full" onClick={() => validar.mutate()} disabled={validar.isPending || analisar.isPending}>
                  {(validar.isPending || analisar.isPending) ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Validando...</> : <>Validar Requisitos <span className="ml-auto text-xs opacity-70">−{AGENT_COSTS.validador} créditos</span></>}
                </Button>
              </CardContent>
            </Card>
          )}

          {["documentacao","baseline"].includes(status) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Documentação Técnica</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">Gere os documentos para entrega à equipe de desenvolvimento</p>
                {(["srs","matriz","arvore","icd"] as const).map(tipo => {
                  const nomes = { srs: "SRS — Especificação", matriz: "Rastreabilidade", arvore: "Árvore / Sprints", icd: "ICD — Interfaces" };
                  const gerado = (artefatos as Array<{tipo: string}>).some(a => a.tipo === tipo);
                  return (
                    <div key={tipo} className="flex gap-1">
                      <Button variant={gerado ? "outline" : "default"} size="sm" className="flex-1 justify-start text-xs" onClick={() => gerarArtefato.mutate(tipo)} disabled={gerarArtefato.isPending}>
                        <FileText className="h-3 w-3 mr-1.5 shrink-0" />
                        {gerado ? "✓ " : ""}{nomes[tipo]}
                      </Button>
                      {gerado && (
                        <Button size="sm" variant="ghost" className="px-2" onClick={() => downloadMd(tipo)} title="Download .md">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {(requisitos as unknown[]).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Requisitos ({(requisitos as unknown[]).length})</CardTitle>
              </CardHeader>
              <CardContent className="max-h-56 overflow-y-auto space-y-2">
                {(requisitos as Array<{codigo: string; descricao: string; tipo: string; score_qualidade: number}>).map(r => (
                  <div key={r.codigo} className="text-xs border rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-primary">{r.codigo}</span>
                      <span className="text-muted-foreground">{r.tipo}</span>
                      {r.score_qualidade && (
                        <span className={cn("ml-auto font-medium", r.score_qualidade >= 0.75 ? "text-green-600" : "text-amber-600")}>
                          {(r.score_qualidade * 100).toFixed(0)}%
                        </span>
                      )}
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
