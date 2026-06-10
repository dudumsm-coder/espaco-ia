import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap, MessageSquare, FileText, CreditCard, BookOpen, ArrowRight } from "lucide-react";
import { fetchArticlesPublic } from "@/services/knowledge.service";

export const metadata: Metadata = {
  title: "Espaço IA — IA para transformação digital",
  description: "Chat com IA especialista, engenharia de requisitos automatizada e consultoria em IA. Comece grátis com 15 créditos mensais.",
  openGraph: {
    title: "Espaço IA — IA para transformação digital",
    description: "Chat com IA, engenharia de requisitos multi-agente e consultoria digital.",
    type: "website",
    siteName: "Espaço IA",
  },
};

export default async function HomePage() {
  const articles = await fetchArticlesPublic();
  const latestArticles = articles.slice(0, 3);

  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      <nav className="flex items-center justify-between px-8 py-5 border-b bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-primary" />
          <span className="font-bold text-xl">Espaço IA</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/blog" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
          <Link href="/sign-in"><Button variant="ghost">Entrar</Button></Link>
          <Link href="/sign-up"><Button>Começar grátis</Button></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-8 py-24">
        <div className="inline-flex items-center gap-2 text-sm text-primary font-medium bg-primary/10 px-4 py-1.5 rounded-full mb-6">
          <Zap className="h-3.5 w-3.5" /> Powered by Claude AI (Anthropic)
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-gray-900 mb-6">
          IA para <span className="text-primary">transformação digital</span>
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Chat com IA especialista, engenharia de requisitos automatizada e consultoria — tudo em um só lugar.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/sign-up"><Button size="lg">Criar conta grátis</Button></Link>
          <Link href="/sign-in"><Button size="lg" variant="outline">Fazer login</Button></Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-8 pb-20 grid grid-cols-1 md:grid-cols-3 gap-8">
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

      {/* Blog preview */}
      {latestArticles.length > 0 && (
        <section className="max-w-5xl mx-auto px-8 pb-24">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 text-sm text-primary font-medium mb-2">
                <BookOpen className="h-4 w-4" /> Blog — IA nos Negócios
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Últimas do blog</h2>
              <p className="text-muted-foreground text-sm mt-1">Curadoria semanal automática por IA</p>
            </div>
            <Link href="/blog" className="flex items-center gap-1 text-sm text-primary font-medium hover:underline">
              Ver todos <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {latestArticles.map(a => (
              <Link key={a.id} href={`/blog/${a.slug}`} className="group rounded-xl border bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-3 leading-snug">
                  {a.title}
                </h3>
                {a.summary && (
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">{a.summary}</p>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(a.created_at))}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <footer className="border-t bg-white/50">
        <div className="max-w-5xl mx-auto px-8 py-8 flex items-center justify-between text-sm text-muted-foreground">
          <span>© 2026 Espaço IA</span>
          <div className="flex gap-6">
            <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
            <Link href="/sign-up" className="hover:text-foreground transition-colors">Criar conta</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
