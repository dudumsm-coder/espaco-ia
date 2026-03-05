import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Sparkles, ArrowLeft, User, Crown, CreditCard, History,
  MessageSquare, Calendar,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAuthenticated, loading } = useAuth();
  const { data: subscription, refetch: refetchSub } = trpc.subscriptions.getMy.useQuery(undefined, { enabled: isAuthenticated });
  const { data: payments } = trpc.profile.getPayments.useQuery(undefined, { enabled: isAuthenticated });
  const { data: sessions } = trpc.agents.getSessions.useQuery({}, { enabled: isAuthenticated });
  const cancelMutation = trpc.subscriptions.cancel.useMutation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Sparkles className="h-12 w-12 animate-pulse text-primary" /></div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 text-center">
          <CardContent className="pt-8 pb-8">
            <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">Faça login</h2>
            <p className="text-muted-foreground mb-6">Entre para ver seu perfil.</p>
            <Button asChild className="w-full"><a href={getLoginUrl()}>Entrar</a></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCancel = async () => {
    if (!confirm("Tem certeza que deseja cancelar sua assinatura?")) return;
    try {
      await cancelMutation.mutateAsync();
      toast.success("Assinatura cancelada");
      refetchSub();
    } catch (error: any) {
      toast.error(error.message || "Erro ao cancelar");
    }
  };

  const formatPrice = (cents: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  const formatDate = (date: Date | string) => new Date(date).toLocaleDateString("pt-BR");

  const activeSessions = sessions?.filter(s => s.status !== "archived") || [];

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
              <h1 className="text-2xl font-bold">{user?.name || "Usuário"}</h1>
              <p className="text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Tabs defaultValue="subscription" className="space-y-6">
            <TabsList>
              <TabsTrigger value="subscription" className="gap-2"><Crown className="h-4 w-4" />Assinatura</TabsTrigger>
              <TabsTrigger value="sessions" className="gap-2"><MessageSquare className="h-4 w-4" />Sessões</TabsTrigger>
              <TabsTrigger value="payments" className="gap-2"><CreditCard className="h-4 w-4" />Pagamentos</TabsTrigger>
            </TabsList>

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
                            {subscription.billingCycle === "monthly" ? "Mensal" : "Anual"} &middot; Status: {" "}
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
                      <div className="flex gap-3">
                        <Button asChild variant="outline"><Link href="/planos">Trocar Plano</Link></Button>
                        {subscription.status === "active" && (
                          <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
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
                      <Button asChild><Link href="/planos">Ver Planos</Link></Button>
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
                                  {session.agentSlug} &middot; {formatDate(session.createdAt)}
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
