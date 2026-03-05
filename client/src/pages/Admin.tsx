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
import { trpc } from "@/lib/trpc";
import { AGENTS, AGENT_SLUGS } from "@shared/types";
import {
  Sparkles, ArrowLeft, Users, BarChart3, Crown, Coins,
  Plus, Trash2, Shield, Activity, Loader2,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const roleOptions = [
  { value: "admin", label: "Administrador", color: "bg-red-100 text-red-700" },
  { value: "editor", label: "Editor", color: "bg-purple-100 text-purple-700" },
  { value: "premium", label: "Premium", color: "bg-amber-100 text-amber-700" },
  { value: "free", label: "Gratuito", color: "bg-gray-100 text-gray-600" },
  { value: "user", label: "Usuário", color: "bg-blue-100 text-blue-700" },
];

export default function Admin() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
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
  const { data: metrics } = trpc.admin.getMetrics.useQuery(undefined, { enabled: isAdmin });
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
          <p className="text-muted-foreground mb-8">Gerencie planos, usuários, créditos e métricas da plataforma.</p>

          {/* Metrics */}
          {isAdmin && metrics && (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center"><Users className="h-5 w-5 text-blue-600" /></div>
                      <div><p className="text-sm text-muted-foreground">Usuários</p><p className="text-2xl font-bold">{metrics.totalUsers}</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center"><Activity className="h-5 w-5 text-emerald-600" /></div>
                      <div><p className="text-sm text-muted-foreground">Sessões Totais</p><p className="text-2xl font-bold">{metrics.totalSessions}</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center"><Crown className="h-5 w-5 text-violet-600" /></div>
                      <div><p className="text-sm text-muted-foreground">Assinaturas Ativas</p><p className="text-2xl font-bold">{metrics.activeSubscriptions}</p></div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-amber-600" /></div>
                      <div><p className="text-sm text-muted-foreground">Agentes Ativos</p><p className="text-2xl font-bold">{metrics.agentUsage?.length ?? 0}</p></div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Role distribution */}
              {metrics.roleStats && metrics.roleStats.length > 0 && (
                <Card className="mb-8">
                  <CardHeader><CardTitle className="text-lg">Distribuição por Papel</CardTitle></CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-3">
                      {metrics.roleStats.map((rs: any) => (
                        <div key={rs.role} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg">
                          {getRoleBadge(rs.role)}
                          <span className="text-lg font-bold">{rs.count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Agent Usage */}
              {metrics.agentUsage && metrics.agentUsage.length > 0 && (
                <Card className="mb-8">
                  <CardHeader><CardTitle className="text-lg">Uso por Agente</CardTitle></CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {metrics.agentUsage.map((a: any) => (
                        <div key={a.agentSlug} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium">{AGENTS[a.agentSlug as keyof typeof AGENTS]?.name || a.agentSlug}</span>
                            <p className="text-xs text-muted-foreground">{Number(a.totalTokens).toLocaleString("pt-BR")} tokens · {a.totalCredits} créditos</p>
                          </div>
                          <Badge variant="secondary">{a.totalSessions} sessões</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Tabs defaultValue={isAdmin ? "users" : "levels"} className="space-y-6">
            <TabsList className="flex-wrap">
              {isAdmin && <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />Usuários</TabsTrigger>}
              <TabsTrigger value="levels" className="gap-2"><Crown className="h-4 w-4" />Níveis de Acesso</TabsTrigger>
            </TabsList>

            {/* Users Tab */}
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
                                  {u.email || "Sem email"} · {u.creditsBalance} créditos · {u.totalTokensUsed.toLocaleString("pt-BR")} tokens
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Role selector */}
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

                              {/* Grant credits */}
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

            {/* Access Levels Tab */}
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

              {/* Existing levels */}
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
