import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { AGENTS, AGENT_SLUGS } from "@shared/types";
import {
  Sparkles, ArrowLeft, Users, BarChart3, Crown, Coins,
  Plus, Trash2, Shield, Activity, Loader2, TrendingUp,
  Zap, MessageSquare, Database, PieChart, AlertCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const roleOptions = [
  { value: "admin", label: "Administrador", color: "bg-red-100 text-red-700" },
  { value: "editor", label: "Editor", color: "bg-purple-100 text-purple-700" },
  { value: "premium", label: "Premium", color: "bg-amber-100 text-amber-700" },
  { value: "free", label: "Gratuito", color: "bg-gray-100 text-gray-600" },
  { value: "user", label: "Usuário", color: "bg-blue-100 text-blue-700" },
];

const agentColors: Record<string, string> = {
  entrevista: "bg-blue-500",
  ideacao: "bg-amber-500",
  analise: "bg-emerald-500",
  requisitos: "bg-violet-500",
  documentacao: "bg-rose-500",
  prototipagem: "bg-cyan-500",
};

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== "admin" && user?.role !== "editor")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="pt-8 pb-8">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground mb-6">
              {!isAuthenticated ? "Faça login como administrador." : "Você não tem permissão de acesso."}
            </p>
            {!isAuthenticated ? (
              <Button asChild className="w-full"><Link href="/login">Entrar</Link></Button>
            ) : (
              <Button asChild className="w-full"><Link href="/">Voltar</Link></Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminDashboard isAdmin={user?.role === "admin"} />;
}

function AdminDashboard({ isAdmin }: { isAdmin: boolean }) {
  const { data: metrics, refetch: refetchMetrics } = trpc.admin.getMetrics.useQuery(
    undefined, { enabled: isAdmin, refetchInterval: 30000 }
  );
  const { data: users, refetch: refetchUsers } = trpc.admin.getUsers.useQuery(undefined, { enabled: isAdmin });
  const { data: levels, refetch: refetchLevels } = trpc.accessLevels.getAll.useQuery(undefined, { enabled: isAdmin });

  const createLevelMutation = trpc.accessLevels.create.useMutation();
  const deleteLevelMutation = trpc.accessLevels.delete.useMutation();
  const updateRoleMutation = trpc.admin.updateUserRole.useMutation();
  const grantCreditsMutation = trpc.admin.grantCredits.useMutation();
  const seedLevelsMutation = trpc.admin.seedLevels.useMutation();

  const [showLevelForm, setShowLevelForm] = useState(false);
  const [grantCreditsUserId, setGrantCreditsUserId] = useState<number | null>(null);
  const [grantCreditsAmount, setGrantCreditsAmount] = useState(100);
  const [grantCreditsDesc, setGrantCreditsDesc] = useState("");
  const [levelForm, setLevelForm] = useState({
    slug: "", name: "", description: "",
    priceMonthly: 0, priceYearly: 0,
    monthlyCredits: 0,
    maxSessionsPerMonth: 5, maxMessagesPerSession: 20,
    maxTokensPerMessage: 4096,
    allowedAgents: [] as string[],
    features: {} as Record<string, boolean>,
    sortOrder: 0, active: true, highlighted: false,
  });

  // Computed metrics for monitoring
  const totalTokens = useMemo(() => {
    if (!metrics?.agentUsage) return 0;
    return (metrics.agentUsage as any[]).reduce((sum: number, a: any) => sum + Number(a.totalTokens || 0), 0);
  }, [metrics]);

  const totalCreditsConsumed = useMemo(() => {
    if (!metrics?.agentUsage) return 0;
    return (metrics.agentUsage as any[]).reduce((sum: number, a: any) => sum + Number(a.totalCredits || 0), 0);
  }, [metrics]);

  const maxAgentSessions = useMemo(() => {
    if (!metrics?.agentUsage || (metrics.agentUsage as any[]).length === 0) return 1;
    return Math.max(...(metrics.agentUsage as any[]).map((a: any) => Number(a.totalSessions || 0)));
  }, [metrics]);

  const handleCreateLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createLevelMutation.mutateAsync(levelForm);
      toast.success("Nível criado com sucesso!");
      setShowLevelForm(false);
      setLevelForm({ slug: "", name: "", description: "", priceMonthly: 0, priceYearly: 0, monthlyCredits: 0, maxSessionsPerMonth: 5, maxMessagesPerSession: 20, maxTokensPerMessage: 4096, allowedAgents: [], features: {}, sortOrder: 0, active: true, highlighted: false });
      refetchLevels();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar nível");
    }
  };

  const handleDeleteLevel = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este nível?")) return;
    try {
      await deleteLevelMutation.mutateAsync({ id });
      toast.success("Nível excluído");
      refetchLevels();
    } catch { toast.error("Erro ao excluir"); }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    try {
      await updateRoleMutation.mutateAsync({ userId, role: newRole as any });
      toast.success(`Papel alterado para ${roleOptions.find(r => r.value === newRole)?.label || newRole}`);
      refetchUsers();
    } catch { toast.error("Erro ao alterar papel"); }
  };

  const handleGrantCredits = async () => {
    if (!grantCreditsUserId || grantCreditsAmount <= 0) return;
    try {
      const result = await grantCreditsMutation.mutateAsync({
        userId: grantCreditsUserId,
        credits: grantCreditsAmount,
        description: grantCreditsDesc || undefined,
      });
      toast.success(`Créditos concedidos! Novo saldo: ${result.newBalance}`);
      setGrantCreditsUserId(null);
      setGrantCreditsAmount(100);
      setGrantCreditsDesc("");
      refetchUsers();
    } catch { toast.error("Erro ao conceder créditos"); }
  };

  const handleSeedLevels = async () => {
    try {
      await seedLevelsMutation.mutateAsync();
      toast.success("Níveis padrão criados!");
      refetchLevels();
    } catch { toast.error("Erro ao criar níveis padrão"); }
  };

  const getRoleBadge = (role: string) => {
    const r = roleOptions.find(o => o.value === role);
    return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${r?.color || "bg-gray-100 text-gray-600"}`}>{r?.label || role}</span>;
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Espaço IA</span>
            <Badge variant="secondary">Admin</Badge>
          </Link>
          <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" />Voltar</Button></Link>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="container max-w-7xl">
          <h1 className="text-3xl font-bold mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground mb-8">Gerencie planos, usuários, créditos e monitore o consumo da plataforma.</p>

          <Tabs defaultValue={isAdmin ? "monitoring" : "levels"} className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              {isAdmin && (
                <TabsTrigger value="monitoring" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Monitoramento
                </TabsTrigger>
              )}
              {isAdmin && (
                <TabsTrigger value="users" className="gap-2">
                  <Users className="h-4 w-4" />
                  Usuários
                </TabsTrigger>
              )}
              <TabsTrigger value="levels" className="gap-2">
                <Crown className="h-4 w-4" />
                Níveis de Acesso
              </TabsTrigger>
            </TabsList>

            {/* ─── MONITORING TAB (ADM ONLY) ─────────────────────────────── */}
            {isAdmin && (
              <TabsContent value="monitoring" className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Monitoramento de Consumo</h2>
                  <Button variant="outline" size="sm" onClick={() => refetchMetrics()}>
                    <Activity className="h-4 w-4 mr-1.5" />
                    Atualizar
                  </Button>
                </div>

                {!metrics ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* KPI Cards */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                              <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total de Usuários</p>
                              <p className="text-2xl font-bold">{metrics.totalUsers}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                              <MessageSquare className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Sessões Totais</p>
                              <p className="text-2xl font-bold">{metrics.totalSessions}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                              <Zap className="h-5 w-5 text-violet-600" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tokens Consumidos</p>
                              <p className="text-2xl font-bold">{totalTokens.toLocaleString("pt-BR")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                              <Coins className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Créditos Consumidos</p>
                              <p className="text-2xl font-bold">{totalCreditsConsumed.toLocaleString("pt-BR")}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Agent Usage - Bar chart style */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="h-5 w-5 text-primary" />
                          Consumo por Agente
                        </CardTitle>
                        <CardDescription>Sessões, tokens e créditos consumidos por cada agente de IA</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {!metrics.agentUsage || (metrics.agentUsage as any[]).length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                            <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                            <p className="text-sm">Nenhuma sessão registrada ainda.</p>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {(metrics.agentUsage as any[]).map((a: any) => {
                              const agent = AGENTS[a.agentSlug as keyof typeof AGENTS];
                              const sessions = Number(a.totalSessions || 0);
                              const tokens = Number(a.totalTokens || 0);
                              const credits = Number(a.totalCredits || 0);
                              const pct = maxAgentSessions > 0 ? Math.round((sessions / maxAgentSessions) * 100) : 0;
                              const barColor = agentColors[a.agentSlug] || "bg-primary";

                              return (
                                <div key={a.agentSlug} className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-3 h-3 rounded-full ${barColor}`} />
                                      <span className="text-sm font-medium">{agent?.name || a.agentSlug}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        {sessions} sessões
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Zap className="h-3 w-3" />
                                        {tokens.toLocaleString("pt-BR")} tokens
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Coins className="h-3 w-3" />
                                        {credits} créditos
                                      </span>
                                    </div>
                                  </div>
                                  <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${barColor}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Two-column: Role distribution + Top users by tokens */}
                    <div className="grid lg:grid-cols-2 gap-6">
                      {/* Role distribution */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <PieChart className="h-5 w-5 text-primary" />
                            Distribuição por Papel
                          </CardTitle>
                          <CardDescription>Quantidade de usuários em cada nível</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {!metrics.roleStats || (metrics.roleStats as any[]).length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Sem dados.</p>
                          ) : (
                            <div className="space-y-3">
                              {(metrics.roleStats as any[]).map((rs: any) => {
                                const total = (metrics.roleStats as any[]).reduce((s: number, r: any) => s + Number(r.count), 0);
                                const pct = total > 0 ? Math.round((Number(rs.count) / total) * 100) : 0;
                                return (
                                  <div key={rs.role} className="space-y-1">
                                    <div className="flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-2">
                                        {getRoleBadge(rs.role)}
                                      </div>
                                      <span className="font-medium">{rs.count} ({pct}%)</span>
                                    </div>
                                    <Progress value={pct} className="h-1.5" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Subscription stats */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Assinaturas
                          </CardTitle>
                          <CardDescription>Status das assinaturas ativas na plataforma</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                <span className="text-sm font-medium">Assinaturas Ativas</span>
                              </div>
                              <span className="text-xl font-bold text-emerald-700">{metrics.activeSubscriptions}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Database className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Total de Sessões</span>
                              </div>
                              <span className="text-xl font-bold">{metrics.totalSessions}</span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-medium">Tokens/Sessão (média)</span>
                              </div>
                              <span className="text-xl font-bold">
                                {metrics.totalSessions > 0
                                  ? Math.round(totalTokens / metrics.totalSessions).toLocaleString("pt-BR")
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Coins className="h-4 w-4 text-amber-600" />
                                <span className="text-sm font-medium">Créditos/Sessão (média)</span>
                              </div>
                              <span className="text-xl font-bold text-amber-700">
                                {metrics.totalSessions > 0
                                  ? Math.round(totalCreditsConsumed / metrics.totalSessions)
                                  : "—"}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Top users by token consumption */}
                    {users && users.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-primary" />
                            Top Usuários por Consumo
                          </CardTitle>
                          <CardDescription>Usuários com maior consumo de tokens na plataforma</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {[...users]
                              .sort((a, b) => Number(b.totalTokensUsed) - Number(a.totalTokensUsed))
                              .slice(0, 10)
                              .map((u, idx) => {
                                const maxTokens = Math.max(...users.map(u => Number(u.totalTokensUsed)));
                                const pct = maxTokens > 0 ? Math.round((Number(u.totalTokensUsed) / maxTokens) * 100) : 0;
                                return (
                                  <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                                    <span className="text-xs font-bold text-muted-foreground w-5 text-right">{idx + 1}</span>
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <span className="text-xs font-semibold text-primary">{(u.name || "U")[0].toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-sm font-medium truncate">{u.name || "Sem nome"}</span>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
                                          <span>{Number(u.totalTokensUsed).toLocaleString("pt-BR")} tokens</span>
                                          <span>{u.creditsBalance} créditos</span>
                                          {getRoleBadge(u.role)}
                                        </div>
                                      </div>
                                      <Progress value={pct} className="h-1" />
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </TabsContent>
            )}

            {/* ─── USERS TAB ──────────────────────────────────────────────── */}
            {isAdmin && (
              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle>Usuários ({users?.length ?? 0})</CardTitle>
                    <CardDescription>Gerencie papéis e créditos dos usuários.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!users || users.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">Nenhum usuário registrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {users.map((u) => (
                          <div key={u.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-sm font-semibold text-primary">{(u.name || "U")[0].toUpperCase()}</span>
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium">{u.name || "Sem nome"}</p>
                                  {getRoleBadge(u.role)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {u.email || "Sem email"} · {u.creditsBalance} créditos · {Number(u.totalTokensUsed).toLocaleString("pt-BR")} tokens
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select value={u.role} onValueChange={(v) => handleChangeRole(u.id, v)}>
                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {roleOptions.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <Dialog open={grantCreditsUserId === u.id} onOpenChange={(open) => { if (!open) setGrantCreditsUserId(null); }}>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setGrantCreditsUserId(u.id)}>
                                    <Coins className="h-3 w-3 mr-1" />
                                    Créditos
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Conceder Créditos para {u.name || "Usuário"}</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4 pt-4">
                                    <p className="text-sm text-muted-foreground">Saldo atual: <strong>{u.creditsBalance}</strong> créditos</p>
                                    <div className="space-y-2">
                                      <Label>Quantidade de créditos</Label>
                                      <Input type="number" value={grantCreditsAmount} onChange={e => setGrantCreditsAmount(Number(e.target.value))} min={1} />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Descrição (opcional)</Label>
                                      <Input value={grantCreditsDesc} onChange={e => setGrantCreditsDesc(e.target.value)} placeholder="Ex: Bônus de boas-vindas" />
                                    </div>
                                    <Button onClick={handleGrantCredits} disabled={grantCreditsMutation.isPending} className="w-full">
                                      <Coins className="h-4 w-4 mr-2" />
                                      Conceder {grantCreditsAmount} Créditos
                                    </Button>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* ─── ACCESS LEVELS TAB ──────────────────────────────────────── */}
            <TabsContent value="levels" className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-xl font-semibold">Níveis de Acesso</h2>
                <div className="flex gap-2">
                  {isAdmin && (!levels || levels.length === 0) && (
                    <Button variant="outline" onClick={handleSeedLevels} disabled={seedLevelsMutation.isPending}>
                      Criar Níveis Padrão
                    </Button>
                  )}
                  {isAdmin && (
                    <Button onClick={() => setShowLevelForm(!showLevelForm)}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Novo Nível
                    </Button>
                  )}
                </div>
              </div>

              {showLevelForm && isAdmin && (
                <Card>
                  <CardHeader>
                    <CardTitle>Criar Novo Nível</CardTitle>
                    <CardDescription>Configure um novo plano de acesso para a plataforma.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleCreateLevel} className="space-y-4">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Slug (identificador)</Label>
                          <Input value={levelForm.slug} onChange={e => setLevelForm({...levelForm, slug: e.target.value})} placeholder="ex: basic" required />
                        </div>
                        <div className="space-y-2">
                          <Label>Nome</Label>
                          <Input value={levelForm.name} onChange={e => setLevelForm({...levelForm, name: e.target.value})} placeholder="ex: Básico" required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição</Label>
                        <Textarea value={levelForm.description} onChange={e => setLevelForm({...levelForm, description: e.target.value})} placeholder="Descrição do plano..." />
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Preço Mensal (centavos)</Label>
                          <Input type="number" value={levelForm.priceMonthly} onChange={e => setLevelForm({...levelForm, priceMonthly: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Preço Anual (centavos)</Label>
                          <Input type="number" value={levelForm.priceYearly} onChange={e => setLevelForm({...levelForm, priceYearly: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Créditos Mensais</Label>
                          <Input type="number" value={levelForm.monthlyCredits} onChange={e => setLevelForm({...levelForm, monthlyCredits: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Sessões/mês (-1 = ilimitado)</Label>
                          <Input type="number" value={levelForm.maxSessionsPerMonth} onChange={e => setLevelForm({...levelForm, maxSessionsPerMonth: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Msgs/sessão (-1 = ilimitado)</Label>
                          <Input type="number" value={levelForm.maxMessagesPerSession} onChange={e => setLevelForm({...levelForm, maxMessagesPerSession: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                          <Label>Tokens/msg (-1 = ilimitado)</Label>
                          <Input type="number" value={levelForm.maxTokensPerMessage} onChange={e => setLevelForm({...levelForm, maxTokensPerMessage: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Agentes Permitidos</Label>
                        <div className="flex flex-wrap gap-2">
                          <button type="button"
                            className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${levelForm.allowedAgents.includes("*") ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                            onClick={() => {
                              if (levelForm.allowedAgents.includes("*")) setLevelForm({...levelForm, allowedAgents: []});
                              else setLevelForm({...levelForm, allowedAgents: ["*"]});
                            }}
                          >Todos</button>
                          {AGENT_SLUGS.map(s => (
                            <button key={s} type="button"
                              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${levelForm.allowedAgents.includes(s) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
                              onClick={() => {
                                const agents = levelForm.allowedAgents.filter(a => a !== "*");
                                if (agents.includes(s)) setLevelForm({...levelForm, allowedAgents: agents.filter(a => a !== s)});
                                else setLevelForm({...levelForm, allowedAgents: [...agents, s]});
                              }}
                            >{AGENTS[s].name}</button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Switch checked={levelForm.active} onCheckedChange={v => setLevelForm({...levelForm, active: v})} />
                          <Label>Ativo</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={levelForm.highlighted} onCheckedChange={v => setLevelForm({...levelForm, highlighted: v})} />
                          <Label>Destacado</Label>
                        </div>
                        <div className="space-y-0">
                          <Label className="text-xs">Ordem</Label>
                          <Input type="number" className="w-20 h-8" value={levelForm.sortOrder} onChange={e => setLevelForm({...levelForm, sortOrder: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button type="submit" disabled={createLevelMutation.isPending}>Criar Nível</Button>
                        <Button type="button" variant="outline" onClick={() => setShowLevelForm(false)}>Cancelar</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {levels?.map((level) => (
                  <Card key={level.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{level.name}</h3>
                            <Badge variant="secondary">{level.slug}</Badge>
                            {level.highlighted && <Badge className="bg-primary text-primary-foreground">Destacado</Badge>}
                            {!level.active && <Badge variant="destructive">Inativo</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{level.description}</p>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>Mensal: R$ {(level.priceMonthly / 100).toFixed(2)}</span>
                            <span>Anual: R$ {(level.priceYearly / 100).toFixed(2)}</span>
                            <span>Créditos: {level.monthlyCredits === -1 ? "Ilimitado" : `${level.monthlyCredits}/mês`}</span>
                            <span>Sessões: {level.maxSessionsPerMonth === -1 ? "Ilimitado" : `${level.maxSessionsPerMonth}/mês`}</span>
                            <span>Msgs: {level.maxMessagesPerSession === -1 ? "Ilimitado" : `${level.maxMessagesPerSession}/sessão`}</span>
                            <span>Agentes: {(level.allowedAgents as string[]).includes("*") ? "Todos" : (level.allowedAgents as string[]).join(", ")}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteLevel(level.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!levels || levels.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum nível de acesso criado. Clique em "Criar Níveis Padrão" para começar.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
