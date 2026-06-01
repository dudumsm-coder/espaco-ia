import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, MessageSquare, FileText, CreditCard } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      <nav className="flex items-center justify-between px-8 py-5 border-b bg-white/80 backdrop-blur">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Espaço IA</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"><Button variant="ghost">Entrar</Button></Link>
          <Link href="/register"><Button>Começar grátis</Button></Link>
        </div>
      </nav>

      <section className="max-w-4xl mx-auto text-center px-8 py-24">
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          IA para <span className="text-primary">transformação digital</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Chat com IA especialista, engenharia de requisitos automatizada e consultoria em IA — tudo em um só lugar.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/register"><Button size="lg">Criar conta grátis</Button></Link>
          <Link href="/login"><Button size="lg" variant="outline">Fazer login</Button></Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-8 pb-24 grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: MessageSquare, title: "Chat IA", desc: "Converse com especialista em IA e transformação digital. 15 créditos grátis todo mês." },
          { icon: FileText, title: "Engenharia de Requisitos", desc: "Sistema multi-agente que elicita, analisa e valida requisitos de software automaticamente." },
          { icon: CreditCard, title: "Pay-as-you-go", desc: "Pague só o que usar. Sem mensalidade fixa. Créditos não expiram." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="rounded-xl border bg-white p-6 shadow-sm">
            <Icon className="h-8 w-8 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">{title}</h3>
            <p className="text-muted-foreground text-sm">{desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
