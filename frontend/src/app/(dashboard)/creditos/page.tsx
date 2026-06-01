"use client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { creditsService } from "@/services/credits.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Star } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export default function CreditosPage() {
  const { data: balance } = useQuery({ queryKey: ["credits-balance"], queryFn: creditsService.getBalance });
  const { data: packages = [] } = useQuery({ queryKey: ["credit-packages"], queryFn: creditsService.listPackages });

  const checkout = useMutation({
    mutationFn: (id: number) => creditsService.createCheckout(id),
    onSuccess: ({ checkout_url }) => window.location.href = checkout_url,
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Créditos</h1>
        <p className="text-muted-foreground text-sm mt-1">Gerencie e compre créditos</p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Saldo atual</p>
          <p className="text-4xl font-bold">{balance?.credits ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">15 créditos grátis todo mês</p>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Pacotes de créditos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {packages.map((pkg) => (
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
                  <p className="text-3xl font-bold">{pkg.credits} <span className="text-sm font-normal text-muted-foreground">créditos</span></p>
                  <p className="text-xl font-semibold text-primary">{formatCurrency(pkg.price_brl)}</p>
                </div>
                <Button
                  className="w-full"
                  variant={pkg.is_popular ? "default" : "outline"}
                  onClick={() => checkout.mutate(pkg.id)}
                  disabled={checkout.isPending}
                >
                  Comprar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
