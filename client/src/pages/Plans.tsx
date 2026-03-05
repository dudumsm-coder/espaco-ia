import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { trpc } from "@/lib/trpc";
import { Sparkles, Check, ArrowLeft, Crown } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

export default function Plans() {
  const { user, isAuthenticated } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: levels, isLoading } = trpc.accessLevels.getActive.useQuery();
  const { data: currentSub } = trpc.subscriptions.getMy.useQuery(undefined, { enabled: isAuthenticated });
  const subscribeMutation = trpc.subscriptions.subscribe.useMutation();

  const handleSubscribe = async (levelId: number) => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    try {
      await subscribeMutation.mutateAsync({ accessLevelId: levelId, billingCycle });
      toast.success("Assinatura realizada com sucesso!");
    } catch (error: any) {
      toast.error(error.message || "Erro ao assinar plano");
    }
  };

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-hero flex items-center justify-center">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Espaço IA</span>
          </Link>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Voltar
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 py-16 lg:py-24">
        <div className="container">
          <div className="text-center mb-12">
            <h1 className="text-3xl lg:text-5xl font-bold mb-4">Escolha seu plano</h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Comece gratuitamente e faça upgrade conforme suas necessidades crescem.
            </p>

            {/* Billing toggle */}
            <div className="inline-flex items-center gap-2 p-1 bg-muted rounded-lg">
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${billingCycle === "monthly" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}
                onClick={() => setBillingCycle("monthly")}
              >
                Mensal
              </button>
              <button
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${billingCycle === "yearly" ? "bg-white shadow-sm" : "hover:bg-white/50"}`}
                onClick={() => setBillingCycle("yearly")}
              >
                Anual
                <Badge variant="secondary" className="ml-2 text-xs">-20%</Badge>
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground">Carregando planos...</div>
          ) : !levels || levels.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-2">Nenhum plano configurado ainda.</p>
              <p className="text-sm text-muted-foreground">O administrador precisa criar os planos no painel admin.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {levels.map((level) => {
                const price = billingCycle === "monthly" ? level.priceMonthly : level.priceYearly;
                const isCurrentPlan = currentSub?.accessLevelId === level.id;
                const isFree = price === 0;
                const features = level.features as Record<string, boolean>;

                return (
                  <Card
                    key={level.id}
                    className={`relative ${level.highlighted ? "border-primary border-2 shadow-lg" : ""}`}
                  >
                    {level.highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          <Crown className="h-3 w-3 mr-1" />
                          Popular
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-4">
                      <CardTitle className="text-xl">{level.name}</CardTitle>
                      {level.description && (
                        <p className="text-sm text-muted-foreground mt-1">{level.description}</p>
                      )}
                      <div className="mt-4">
                        <span className="text-4xl font-bold">{isFree ? "Grátis" : formatPrice(price)}</span>
                        {!isFree && (
                          <span className="text-muted-foreground text-sm">/{billingCycle === "monthly" ? "mês" : "ano"}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          <span>{level.monthlyCredits === -1 ? "Créditos ilimitados" : `${level.monthlyCredits} créditos/mês`}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          <span>{level.maxSessionsPerMonth === -1 ? "Sessões ilimitadas" : `${level.maxSessionsPerMonth} sessões/mês`}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          <span>{level.maxMessagesPerSession === -1 ? "Mensagens ilimitadas" : `${level.maxMessagesPerSession} msgs/sessão`}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary shrink-0" />
                          <span>
                            {(level.allowedAgents as string[]).includes("*")
                              ? "Todos os agentes"
                              : `${(level.allowedAgents as string[]).length} agente(s)`}
                          </span>
                        </div>
                        {Object.entries(features).map(([key, enabled]) => (
                          enabled && (
                            <div key={key} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-primary shrink-0" />
                              <span>{key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                            </div>
                          )
                        ))}
                      </div>

                      <Button
                        className="w-full"
                        variant={level.highlighted ? "default" : "outline"}
                        disabled={isCurrentPlan || subscribeMutation.isPending}
                        onClick={() => handleSubscribe(level.id)}
                      >
                        {isCurrentPlan ? "Plano Atual" : isFree ? "Começar Grátis" : "Assinar"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Espaço IA. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
