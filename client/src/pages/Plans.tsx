import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Sparkles, Check, ArrowLeft, Crown, Building2,
  Mail, Phone, MessageSquare, Zap, Users, Infinity,
} from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { useState } from "react";

// Plano Empresarial estático (não é um nível de acesso, é um CTA de contato)
const ENTERPRISE_PLAN = {
  name: "Empresarial",
  description: "Solução personalizada para equipes e empresas com alto volume de uso.",
  features: [
    "Todos os agentes ilimitados",
    "Créditos personalizados",
    "SLA garantido",
    "Suporte dedicado 24/7",
    "Integração via API",
    "Treinamento da equipe",
    "Relatórios avançados",
    "Contrato personalizado",
  ],
};

// Slugs que NÃO devem aparecer na página de planos comerciais
const INTERNAL_SLUGS = ["editor", "admin"];

export default function Plans() {
  const { user, isAuthenticated } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  const { data: allLevels, isLoading } = trpc.accessLevels.getActive.useQuery();
  const { data: currentSub } = trpc.subscriptions.getMy.useQuery(undefined, { enabled: isAuthenticated });
  const subscribeMutation = trpc.subscriptions.subscribe.useMutation();
  const checkoutMutation = trpc.payments.createCheckout.useMutation();

  // Filtra apenas planos comerciais (remove editor e admin)
  const levels = allLevels?.filter((l) => !INTERNAL_SLUGS.includes(l.slug)) ?? [];

  const handleSubscribe = async (levelId: number, isFree: boolean, levelSlug: string) => {
    if (!isAuthenticated) {
      window.location.href = "/login";
      return;
    }
    try {
      if (isFree) {
        // Free plan: activate directly
        await subscribeMutation.mutateAsync({ accessLevelId: levelId, billingCycle });
        toast.success("Plano gratuito ativado!");
      } else {
        // Paid plan: redirect to Stripe Checkout
        toast.info("Redirecionando para o checkout...");
        const { checkoutUrl } = await checkoutMutation.mutateAsync({
          origin: window.location.origin,
        });
        window.open(checkoutUrl, "_blank");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao processar assinatura");
    }
  };

  const handleContactEnterprise = () => {
    window.open("mailto:contato@espacoia.com.br?subject=Interesse%20no%20Plano%20Empresarial&body=Olá%2C%20tenho%20interesse%20no%20plano%20Empresarial%20do%20Espaço%20IA.%20Gostaria%20de%20mais%20informações.", "_blank");
  };

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

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

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 lg:py-24 text-center">
          <div className="container max-w-3xl">
            <Badge variant="secondary" className="mb-4 px-3 py-1">
              <Zap className="h-3 w-3 mr-1.5" />
              Planos e Preços
            </Badge>
            <h1 className="text-3xl lg:text-5xl font-bold mb-4">
              Escolha o plano ideal para você
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Comece gratuitamente e faça upgrade conforme suas necessidades crescem.
              Cancele a qualquer momento.
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
                <Badge variant="secondary" className="ml-2 text-xs bg-emerald-100 text-emerald-700">
                  Economize 20%
                </Badge>
              </button>
            </div>
          </div>
        </section>

        {/* Plans grid */}
        <section className="pb-16 lg:pb-24">
          <div className="container">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-3 animate-pulse text-primary" />
                Carregando planos...
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
                {/* Dynamic plans from DB (free, premium, etc.) */}
                {levels.map((level) => {
                  const price = billingCycle === "monthly" ? level.priceMonthly : level.priceYearly;
                  const isCurrentPlan = currentSub?.accessLevelId === level.id;
                  const isFree = price === 0;
                  const features = level.features as Record<string, boolean>;
                  const featureLabels: Record<string, string> = {
                    basicChat: "Chat com agentes de IA",
                    exportPdf: "Exportar relatórios em PDF",
                    prioritySupport: "Suporte prioritário",
                    customPrompts: "Prompts personalizados",
                    editSite: "Edição do site",
                    manageUsers: "Gestão de usuários",
                    manageAccess: "Gestão de acessos",
                  };

                  return (
                    <Card
                      key={level.id}
                      className={`relative flex flex-col ${level.highlighted ? "border-primary border-2 shadow-xl scale-105" : "border"}`}
                    >
                      {level.highlighted && (
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground px-3 py-1">
                            <Crown className="h-3 w-3 mr-1" />
                            Mais Popular
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="text-center pb-4 pt-8">
                        <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${level.highlighted ? "bg-primary/10" : "bg-muted"}`}>
                          {isFree ? (
                            <Sparkles className={`h-6 w-6 ${level.highlighted ? "text-primary" : "text-muted-foreground"}`} />
                          ) : (
                            <Crown className={`h-6 w-6 ${level.highlighted ? "text-primary" : "text-muted-foreground"}`} />
                          )}
                        </div>
                        <CardTitle className="text-xl">{level.name}</CardTitle>
                        {level.description && (
                          <p className="text-sm text-muted-foreground mt-1">{level.description}</p>
                        )}
                        <div className="mt-5">
                          {isFree ? (
                            <div>
                              <span className="text-4xl font-bold">Grátis</span>
                              <p className="text-xs text-muted-foreground mt-1">Para sempre</p>
                            </div>
                          ) : (
                            <div>
                              <span className="text-4xl font-bold">{formatPrice(price)}</span>
                              <span className="text-muted-foreground text-sm">/{billingCycle === "monthly" ? "mês" : "ano"}</span>
                              {billingCycle === "yearly" && (
                                <p className="text-xs text-emerald-600 mt-1 font-medium">
                                  {formatPrice(level.priceMonthly * 12 - level.priceYearly)} de economia/ano
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="flex-1 flex flex-col space-y-4">
                        <div className="space-y-2.5 flex-1">
                          {/* Core limits */}
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0" />
                            <span>
                              {level.monthlyCredits === -1
                                ? "Créditos ilimitados"
                                : `${level.monthlyCredits.toLocaleString("pt-BR")} créditos/mês`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0" />
                            <span>
                              {level.maxSessionsPerMonth === -1
                                ? "Sessões ilimitadas"
                                : `${level.maxSessionsPerMonth} sessões/mês`}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary shrink-0" />
                            <span>
                              {(level.allowedAgents as string[]).includes("*")
                                ? "Todos os 6 agentes de IA"
                                : `${(level.allowedAgents as string[]).length} agente(s) de IA`}
                            </span>
                          </div>
                          {/* Feature flags */}
                          {Object.entries(features).map(([key, enabled]) =>
                            enabled && featureLabels[key] ? (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <Check className="h-4 w-4 text-primary shrink-0" />
                                <span>{featureLabels[key]}</span>
                              </div>
                            ) : null
                          )}
                        </div>

                        <Button
                          className="w-full mt-4"
                          variant={level.highlighted ? "default" : "outline"}
                          disabled={isCurrentPlan || subscribeMutation.isPending}
                          onClick={() => handleSubscribe(level.id, isFree, level.slug)}
                        >
                          {isCurrentPlan
                            ? "✓ Plano Atual"
                            : isFree
                            ? "Começar Grátis"
                            : "Assinar Agora"}
                        </Button>
                        {!isAuthenticated && !isFree && (
                          <p className="text-xs text-center text-muted-foreground">
                            É necessário criar uma conta para assinar
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* Enterprise plan - static CTA card */}
                <Card className="relative flex flex-col border-2 border-dashed border-muted-foreground/30 bg-gradient-to-br from-slate-50 to-slate-100">
                  <CardHeader className="text-center pb-4 pt-8">
                    <div className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-slate-200">
                      <Building2 className="h-6 w-6 text-slate-600" />
                    </div>
                    <CardTitle className="text-xl">{ENTERPRISE_PLAN.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{ENTERPRISE_PLAN.description}</p>
                    <div className="mt-5">
                      <span className="text-2xl font-bold text-slate-700">Sob consulta</span>
                      <p className="text-xs text-muted-foreground mt-1">Preço personalizado para sua empresa</p>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col space-y-4">
                    <div className="space-y-2.5 flex-1">
                      {ENTERPRISE_PLAN.features.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-slate-500 shrink-0" />
                          <span className="text-slate-700">{feature}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2 mt-4">
                      <Button
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white"
                        onClick={handleContactEnterprise}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Falar com Especialista
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Resposta em até 24 horas úteis
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>

        {/* FAQ / Guarantee section */}
        <section className="py-12 bg-muted/30 border-t">
          <div className="container max-w-3xl text-center">
            <h2 className="text-2xl font-bold mb-4">Perguntas Frequentes</h2>
            <div className="grid sm:grid-cols-2 gap-6 text-left mt-8">
              <div>
                <h3 className="font-semibold mb-1">O que são créditos?</h3>
                <p className="text-sm text-muted-foreground">
                  Créditos são a moeda da plataforma. Cada mensagem enviada aos agentes consome créditos proporcionalmente ao número de tokens processados pela IA.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Posso cancelar a qualquer momento?</h3>
                <p className="text-sm text-muted-foreground">
                  Sim. Você pode cancelar sua assinatura a qualquer momento sem multas. O acesso continua até o fim do período pago.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Os créditos acumulam?</h3>
                <p className="text-sm text-muted-foreground">
                  Créditos não utilizados no mês não expiram imediatamente — eles permanecem no seu saldo. Novos créditos são adicionados a cada renovação.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">Preciso de cartão para o plano gratuito?</h3>
                <p className="text-sm text-muted-foreground">
                  Não. O plano gratuito não exige cartão de crédito. Basta criar uma conta e começar a usar imediatamente.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Espaço IA. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
