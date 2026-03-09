import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  Sparkles, ArrowLeft, User, Crown, CreditCard, History,
  MessageSquare, Coins, TrendingDown, TrendingUp, Loader2,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: "Administrador", color: "bg-red-100 text-red-700 border-red-200" },
  editor: { label: "Editor", color: "bg-purple-100 text-purple-700 border-purple-200" },
  premium: { label: "Premium", color: "bg-amber-100 text-amber-700 border-amber-200" },
  free: { label: "Gratuito", color: "bg-gray-100 text-gray-600 border-gray-200" },
  user: { label: "Usuário", color: "bg-blue-100 text-blue-700 border-blue-200" },
};

export default function Profile() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: subscription, refetch: refetchSub } = trpc.subscriptions.getMy.useQuery(undefined, { enabled: isAuthenticated });
  const { data: payments } = trpc.profile.getPayments.useQuery(undefined, { enabled: isAuthenticated });
  const { data: sessions } = trpc.agents.getSessions.useQuery({}, { enabled: isAuthenticated });
  const { data: creditData } = trpc.credits.getBalance.useQuery(undefined, { enabled: isAuthenticated });
  const { data: transactions } = trpc.credits.getTransactions.useQuery(undefined, { enabled: isAuthenticated });
  const cancelMutation = trpc.subscriptions.cancel.useMutation();
  const checkoutMutation = trpc.payments.createCheckout.useMutation();
  const portalMutation = trpc.payments.openPortal.useMutation();
  const stripeCancelMutation = trpc.payments.cancelSubscription.useMutation();
  const { data: paymentHistory } = trpc.payments.getHistory.useQuery(undefined, { enabled: isAuthenticated });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="pt-8 pb-8">
            <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Faça login</h2>
            <p className="text-muted-foreground mb-6">Entre para ver seu perfil.</p>
            <Button asChild className="w-full"><Link href="/login">Entrar</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura?")) return;
    try {
      // Try Stripe cancel first (if has Stripe subscription)
      const dbUser = await fetch("/api/trpc/auth.me").then(r => r.json()).catch(() => null);
      if (user?.stripeSubscriptionId) {
        await stripeCancelMutation.mutateAsync();
        toast.success("Assinatura será cancelada ao fim do período atual");
      } else {
        await cancelMutation.mutateAsync();
        toast.success("Assinatura cancelada");
      }
      refetchSub();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar");
    }
  };

  const handleUpgrade = async () => {
    try {
      toast.info("Redirecionando para o checkout...");
      const { checkoutUrl } = await checkoutMutation.mutateAsync({ origin: window.location.origin });
      window.open(checkoutUrl, "_blank");
    } catch (error: any) {
      toast.error(error.message || "Erro ao abrir checkout");
    }
  };

  const handleManageBilling = async () => {
    try {
      const { portalUrl } = await portalMutation.mutateAsync({ origin: window.location.origin });
      window.open(portalUrl, "_blank");
    } catch (error: any) {
      toast.error("Nenhuma assinatura Stripe encontrada. Assine um plano primeiro.");
    }
  };

  const formatPrice = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const formatDate = (date: Date | string) => new Date(date).toLocaleDateString("pt-BR");
  const activeSessions = sessions?.filter(s => s.status !== "archived") || [];
  const roleBadge = user?.role ? roleLabels[user.role] || roleLabels.user : null;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Espaço IA</span>
          </Link>
          <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1.5" />Voltar</Button></Link>
        </div>
      </header>

      <main className="flex-1 py-8 lg:py-12">
        <div className="container max-w-4xl">
          {/* Profile header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{user?.name || "Usuário"}</h1>
                {roleBadge && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Créditos</span>
                </div>
                <p className="text-2xl font-bold">
                  {creditData?.isAdmin ? "∞" : (creditData?.balance ?? 0)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Tokens Usados</span>
                </div>
                <p className="text-2xl font-bold">{(creditData?.totalTokensUsed ?? 0).toLocaleString("pt-BR")}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  <span className="text-xs text-muted-foreground">Créditos Gastos</span>
                </div>
                <p className="text-2xl font-bold">{creditData?.totalCreditsSpent ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Sessões</span>
                </div>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="credits" className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="credits" className="gap-2"><Coins className="h-4 w-4" />Créditos</TabsTrigger>
              <TabsTrigger value="subscription" className="gap-2"><Crown className="h-4 w-4" />Assinatura</TabsTrigger>
              <TabsTrigger value="sessions" className="gap-2"><MessageSquare className="h-4 w-4" />Sessões</TabsTrigger>
              <TabsTrigger value="payments" className="gap-2"><CreditCard className="h-4 w-4" />Pagamentos</TabsTrigger>
            </TabsList>

            {/* Credits Tab */}
            <TabsContent value="credits">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-amber-500" />
                    Histórico de Créditos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {creditData?.isAdmin && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 text-sm text-red-800">
                      <strong>Administrador:</strong> Você tem créditos ilimitados. O consumo de tokens é registrado mas não debita créditos.
                    </div>
                  )}
                  {!transactions || transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <Coins className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhuma transação de créditos ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div>
                            <p className="text-sm font-medium">{tx.description || tx.type}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.createdAt)}
                              {tx.tokensConsumed ? ` · ${tx.tokensConsumed} tokens` : ""}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-bold ${tx.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                              {tx.amount >= 0 ? "+" : ""}{tx.amount}
                            </p>
                            <p className="text-xs text-muted-foreground">Saldo: {tx.balanceAfter}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subscription Tab */}
            <TabsContent value="subscription">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Crown className="h-5 w-5 text-primary" />
                    Sua Assinatura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {subscription ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                        <div>
                          <h3 className="font-semibold text-lg">{(subscription as any).accessLevel?.name || "Plano"}</h3>
                          <p className="text-sm text-muted-foreground">
                            {subscription.billingCycle === "monthly" ? "Mensal" : "Anual"} · Status:{" "}
                            <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                              {subscription.status === "active" ? "Ativo" : subscription.status}
                            </Badge>
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Sessões usadas</p>
                          <p className="text-2xl font-bold">{subscription.sessionsUsedThisPeriod}</p>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-muted-foreground">Início do período</p>
                          <p className="font-medium">{formatDate(subscription.currentPeriodStart)}</p>
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg">
                          <p className="text-muted-foreground">Fim do período</p>
                          <p className="font-medium">{formatDate(subscription.currentPeriodEnd)}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        <Button asChild variant="outline"><Link href="/planos">Trocar Plano</Link></Button>
                        <Button
                          variant="outline"
                          onClick={handleManageBilling}
                          disabled={portalMutation.isPending}
                        >
                          <CreditCard className="h-4 w-4 mr-2" />
                          Gerenciar Cobranças
                        </Button>
                        {subscription.status === "active" && (
                          <Button
                            variant="destructive"
                            onClick={handleCancel}
                            disabled={cancelMutation.isPending || stripeCancelMutation.isPending}
                          >
                            Cancelar Assinatura
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Crown className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <h3 className="font-semibold mb-2">Nenhuma assinatura ativa</h3>
                      <p className="text-muted-foreground mb-4">Você está no plano gratuito com acesso limitado.</p>
                      <div className="flex gap-3 justify-center">
                        <Button asChild><Link href="/planos">Ver Planos</Link></Button>
                        <Button
                          variant="outline"
                          onClick={handleUpgrade}
                          disabled={checkoutMutation.isPending}
                        >
                          <Crown className="h-4 w-4 mr-2" />
                          Assinar Premium
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sessions Tab */}
            <TabsContent value="sessions">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    Minhas Sessões ({activeSessions.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activeSessions.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhuma sessão ainda.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeSessions.map((session) => (
                        <Link key={session.id} href={`/agente/${session.agentSlug}`}>
                          <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3">
                              <MessageSquare className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm font-medium">{session.title || "Sessão sem título"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {session.agentSlug} · {formatDate(session.createdAt)}
                                  {session.totalTokensUsed > 0 && ` · ${session.totalTokensUsed} tokens`}
                                </p>
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">{session.status}</Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Histórico de Pagamentos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!payments || payments.length === 0 ? (
                    <div className="text-center py-8">
                      <History className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <p className="text-muted-foreground">Nenhum pagamento registrado.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div>
                            <p className="text-sm font-medium">{payment.description || "Pagamento"}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(payment.createdAt)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{formatPrice(payment.amountCents)}</p>
                            <Badge variant={payment.status === "completed" ? "default" : "secondary"} className="text-xs">
                              {payment.status === "completed" ? "Pago" : payment.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
