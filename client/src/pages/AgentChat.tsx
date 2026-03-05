import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { AGENTS, type AgentSlug } from "@shared/types";
import {
  Mic, Lightbulb, Search, ClipboardList, FileText, Layers,
  Sparkles, Send, Bot, User, ArrowLeft, Plus, MessageSquare, Trash2,
  Coins, AlertTriangle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";

const iconMap: Record<string, React.ElementType> = {
  Mic, Lightbulb, Search, ClipboardList, FileText, Layers,
};

const colorMap: Record<string, { text: string; bg: string; iconBg: string }> = {
  blue:    { text: "text-blue-600",    bg: "bg-blue-600",    iconBg: "bg-blue-100" },
  amber:   { text: "text-amber-600",   bg: "bg-amber-600",   iconBg: "bg-amber-100" },
  emerald: { text: "text-emerald-600", bg: "bg-emerald-600", iconBg: "bg-emerald-100" },
  violet:  { text: "text-violet-600",  bg: "bg-violet-600",  iconBg: "bg-violet-100" },
  rose:    { text: "text-rose-600",    bg: "bg-rose-600",    iconBg: "bg-rose-100" },
  cyan:    { text: "text-cyan-600",    bg: "bg-cyan-600",    iconBg: "bg-cyan-100" },
};

export default function AgentChat() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug as AgentSlug;
  const agent = AGENTS[slug];
  const { user, isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [message, setMessage] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const colors = colorMap[agent?.color] || colorMap.blue;
  const Icon = iconMap[agent?.icon] || Sparkles;

  const createSessionMutation = trpc.agents.createSession.useMutation();
  const sendMessageMutation = trpc.agents.sendMessage.useMutation();
  const deleteSessionMutation = trpc.agents.deleteSession.useMutation();
  const utils = trpc.useUtils();

  const { data: sessions, refetch: refetchSessions } = trpc.agents.getSessions.useQuery(
    { agentSlug: slug },
    { enabled: isAuthenticated && !!slug }
  );

  const { data: chatMessages, refetch: refetchMessages } = trpc.agents.getMessages.useQuery(
    { sessionId: currentSessionId! },
    { enabled: currentSessionId !== null }
  );

  const { data: creditData } = trpc.credits.getBalance.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [chatMessages, sendMessageMutation.isPending]);

  if (!agent) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center p-8">
          <h2 className="text-xl font-bold mb-2">Agente não encontrado</h2>
          <p className="text-muted-foreground mb-4">O agente solicitado não existe.</p>
          <Button asChild><Link href="/">Voltar ao início</Link></Button>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Bot className="h-12 w-12 animate-pulse text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="pt-8 pb-8">
            <div className={`w-16 h-16 rounded-2xl ${colors.iconBg} flex items-center justify-center mx-auto mb-4`}>
              <Icon className={`h-8 w-8 ${colors.text}`} />
            </div>
            <h2 className="text-2xl font-bold mb-2">{agent.name}</h2>
            <p className="text-muted-foreground mb-6">Faça login para conversar com este agente.</p>
            <Button asChild className="w-full"><Link href="/login">Entrar / Criar Conta</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleNewSession = async () => {
    try {
      const result = await createSessionMutation.mutateAsync({ agentSlug: slug });
      setCurrentSessionId(result.sessionId);
      refetchSessions();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar sessão");
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !currentSessionId) return;
    const userMessage = message;
    setMessage("");
    try {
      const result = await sendMessageMutation.mutateAsync({ sessionId: currentSessionId, message: userMessage });
      refetchMessages();
      utils.credits.getBalance.invalidate();
      if (result.tokensUsed > 0 && result.creditsCharged > 0) {
        toast.info(`${result.tokensUsed} tokens usados (${result.creditsCharged} créditos)`, { duration: 3000 });
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao enviar mensagem");
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await deleteSessionMutation.mutateAsync({ sessionId });
      if (currentSessionId === sessionId) setCurrentSessionId(null);
      refetchSessions();
      toast.success("Sessão removida");
    } catch {
      toast.error("Erro ao remover sessão");
    }
  };

  const activeSessions = sessions?.filter(s => s.status !== "archived") || [];
  const lowCredits = creditData && !creditData.isAdmin && creditData.balance < 50;

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md h-14 flex items-center px-4 gap-3 flex-shrink-0 z-10">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center flex-shrink-0`}>
            <Icon className={`h-4 w-4 ${colors.text}`} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold leading-tight truncate">{agent.name}</h1>
            <p className="text-xs text-muted-foreground hidden sm:block truncate">{agent.description.substring(0, 60)}...</p>
          </div>
        </div>

        {/* Credits indicator */}
        {creditData && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold flex-shrink-0 ${
            creditData.isAdmin
              ? "bg-red-50 border-red-200 text-red-700"
              : lowCredits
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-emerald-50 border-emerald-200 text-emerald-700"
          }`}>
            {creditData.isAdmin ? (
              <>
                <Sparkles className="h-3 w-3" />
                Ilimitado
              </>
            ) : (
              <>
                <Coins className="h-3 w-3" />
                {creditData.balance} créditos
              </>
            )}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={handleNewSession} disabled={createSessionMutation.isPending} className="flex-shrink-0">
          <Plus className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Nova Sessão</span>
        </Button>
      </header>

      {/* Low credits warning */}
      {lowCredits && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-sm text-amber-800 flex-shrink-0">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Seus créditos estão baixos ({creditData.balance} restantes).</span>
          <Link href="/planos" className="font-semibold underline ml-1">Fazer upgrade</Link>
        </div>
      )}

      {/* Main content area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - Sessions */}
        <aside className="w-64 border-r bg-muted/30 hidden md:flex md:flex-col flex-shrink-0 min-h-0">
          <div className="p-3 pb-1 flex-shrink-0">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">Sessões</h3>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <div className="space-y-1">
              {activeSessions.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">
                  Nenhuma sessão. Clique em "Nova Sessão" para começar.
                </p>
              ) : (
                activeSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`group flex items-center gap-2 px-2.5 py-2 rounded-md text-sm cursor-pointer transition-colors ${
                      currentSessionId === session.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'
                    }`}
                    onClick={() => setCurrentSessionId(session.id)}
                  >
                    <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate flex-1">{session.title || "Nova sessão"}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {currentSessionId === null ? (
            <div className="flex-1 flex items-center justify-center p-8 overflow-y-auto">
              <div className="text-center max-w-md">
                <div className={`w-20 h-20 rounded-2xl ${colors.iconBg} flex items-center justify-center mx-auto mb-6`}>
                  <Icon className={`h-10 w-10 ${colors.text}`} />
                </div>
                <h2 className="text-2xl font-bold mb-3">{agent.name}</h2>
                <p className="text-muted-foreground mb-6">{agent.description}</p>
                <Button onClick={handleNewSession} disabled={createSessionMutation.isPending} size="lg">
                  <Plus className="h-4 w-4 mr-2" />
                  Iniciar Nova Sessão
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages - scrollable area */}
              <div
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto p-4 lg:p-6"
              >
                <div className="max-w-3xl mx-auto space-y-4">
                  {(!chatMessages || chatMessages.length === 0) && !sendMessageMutation.isPending && (
                    <div className="text-center py-12">
                      <div className={`w-14 h-14 rounded-xl ${colors.iconBg} flex items-center justify-center mx-auto mb-4`}>
                        <Icon className={`h-7 w-7 ${colors.text}`} />
                      </div>
                      <h3 className="font-semibold mb-1">Comece a conversa</h3>
                      <p className="text-sm text-muted-foreground">Descreva o que você precisa e o agente irá ajudá-lo.</p>
                    </div>
                  )}

                  {chatMessages?.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center shrink-0 mt-1`}>
                          <Icon className={`h-4 w-4 ${colors.text}`} />
                        </div>
                      )}
                      <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm max-w-none dark:prose-invert">
                            <Streamdown>{msg.content}</Streamdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                        {msg.role === "assistant" && (msg.tokensUsed > 0 || msg.creditsCharged > 0) && (
                          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                            <span>{msg.tokensUsed} tokens</span>
                            <span>·</span>
                            <span>{msg.creditsCharged} créditos</span>
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 mt-1">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}

                  {sendMessageMutation.isPending && (
                    <div className="flex gap-3 justify-start">
                      <div className={`w-8 h-8 rounded-lg ${colors.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4 w-4 ${colors.text} animate-pulse`} />
                      </div>
                      <div className="bg-muted rounded-xl px-4 py-3">
                        <div className="flex gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Input - fixed at bottom */}
              <div className="border-t bg-white p-4 flex-shrink-0">
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                  className="max-w-3xl mx-auto flex gap-2"
                >
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    disabled={sendMessageMutation.isPending}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={!message.trim() || sendMessageMutation.isPending} size="icon">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
