"use client";
import { useAuthStore } from "@/store/auth.store";
import { useQuery } from "@tanstack/react-query";
import { creditsService } from "@/services/credits.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { MessageSquare, FileText, Calendar, CreditCard, Zap } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { data: balance } = useQuery({ queryKey: ["credits-balance"], queryFn: creditsService.getBalance });

  const cards = [
    { title: "Chat IA", desc: "Converse com especialista em IA", href: "/chat", icon: MessageSquare, color: "text-violet-500" },
    { title: "Engenharia de Req.", desc: "Multi-agentes para seus projetos", href: "/engenharia", icon: FileText, color: "text-blue-500" },
    { title: "Agendamentos", desc: "Agende uma consultoria", href: "/agendamentos", icon: Calendar, color: "text-green-500" },
    { title: "Créditos", desc: "Gerencie seus créditos", href: "/creditos", icon: CreditCard, color: "text-orange-500" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Olá, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground mt-1">Bem-vindo ao Espaço IA</p>
      </div>

      <div className="flex items-center gap-4 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Zap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Créditos disponíveis</p>
          <p className="text-3xl font-bold">{balance?.credits ?? user?.credits ?? 0}</p>
        </div>
        <Link href="/creditos" className="ml-auto">
          <Button variant="outline" size="sm">Comprar mais</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(({ title, desc, href, icon: Icon, color }) => (
          <Link key={href} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardHeader>
                <Icon className={`h-8 w-8 ${color} mb-2`} />
                <CardTitle className="text-lg">{title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
