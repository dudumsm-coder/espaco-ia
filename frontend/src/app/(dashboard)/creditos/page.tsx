"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { creditsService } from "@/services/credits.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Star, AlertTriangle, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function CreditosPage() {
  const searchParams = useSearchParams();
  const insuficiente = searchParams.get("insuficiente") === "1";
  const sucesso = searchParams.get("success") === "true";

  const { data: balance } = useQuery({
    queryKey: ["credits-balance"],
    queryFn: creditsService.getBalance,
  });

  const { data: packages = [] } = useQuery({
    queryKey: ["credit-packages"],
    queryFn: creditsService.listPackages,
  });

  const checkout = useMutation({
    mutationFn: (id: number) => creditsService.createCheckout(id),
    onSuccess: ({ checkout_url }) => { window.location.href = checkout_url; },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Créditos</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie e compre créditos</p>
      </div>

      {/* Banner saldo insuficiente */}
      {insuficiente && (
        <div className="flex gap-3 items-start rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800 text-sm">Créditos insuficientes</p>
            <p className="text-amber-700 text-sm mt-1">
              Você não tem créditos suficientes para continuar. Escolha um pacote abaixo para recarregar e voltar de onde parou.
            </p>
          </div>
        </div>
      )}

      {/* Banner compra concluída */}
      {sucesso && (
        <div className="flex gap-3 items-start rounded-xl border border-green-200 bg-green-50 p-4">
          <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800 text-sm">Créditos adicionados com sucesso!</p>
            <p className="text-green-700 text-sm mt-1">Seu saldo foi atualizado. Você já pode continuar usando os agentes.</p>
          </div>
        </div>
      )}

      {/* Saldo atual */}
      <div className="flex items-center gap-4 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">Saldo atual</p>
          <p className="text-4xl font-bold">{balance?.credits ?? 0} <span className="text-base font-normal text-muted-foreground">créditos</span></p>
          <p className="text-xs text-muted-foreground mt-1">15 créditos grátis todo mês</p>
        </div>
      </div>

      {/* Custo dos agentes */}
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-sm font-semibold mb-3">Custo por operação</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Consultor", detail: "por mensagem", cost: 5, color: "text-blue-600" },
            { label: "Analisador", detail: "por análise", cost: 60, color: "text-violet-600" },
            { label: "Validador", detail: "por validação", cost: 40, color: "text-orange-600" },
            { label: "Documentador", detail: "por artefato", cost: 50, color: "text-green-600" },
          ].map(({ label, detail, cost, color }) => (
            <div key={label} className="rounded-lg border bg-white p-3 text-center">
              <p className={`text-xl font-bold ${color}`}>{cost}</p>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pacotes */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Escolha um pacote</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(packages as Array<{ id: number; name: string; credits: number; price_brl: number; is_popular: boolean }>).map((pkg) => (
            <Card key={pkg.id} className={pkg.is_popular ? "border-primary shadow-md" : ""}>
              {pkg.is_popular && (
                <div className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-t-lg">
                  <Star className="h-3 w-3" /> Mais popular
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-3xl font-bold">
                    {pkg.credits} <span className="text-sm font-normal text-muted-foreground">créditos</span>
                  </p>
                  <p className="text-xl font-semibold text-primary">{formatCurrency(pkg.price_brl)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ {Math.floor(pkg.credits / 60)} análises completas
                  </p>
                </div>
                <Button
                  className="w-full"
                  variant={pkg.is_popular ? "default" : "outline"}
                  onClick={() => checkout.mutate(pkg.id)}
                  disabled={checkout.isPending}
                >
                  {checkout.isPending ? "Aguarde..." : "Comprar agora"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
