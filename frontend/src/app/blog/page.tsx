import type { Metadata } from "next";
import Link from "next/link";
import { fetchArticlesPublic } from "@/services/knowledge.service";
import { Clock, Tag, Zap } from "lucide-react";

export const metadata: Metadata = {
  title: "Blog — IA nos Negócios | Espaço IA",
  description: "Tendências e aplicações de inteligência artificial para gestores e empreendedores. Publicado toda segunda-feira com curadoria automática.",
  openGraph: {
    title: "Blog — IA nos Negócios | Espaço IA",
    description: "Tendências semanais de IA para empresas, com casos reais e análises práticas.",
    type: "website",
    siteName: "Espaço IA",
  },
  alternates: { canonical: "/blog" },
};

function readingTime(content: string) {
  return Math.max(1, Math.round(content.split(" ").length / 200));
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dateStr));
}

export default async function BlogPage() {
  const articles = await fetchArticlesPublic();

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Zap className="h-5 w-5 text-primary" />
            Espaço IA
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/blog" className="font-medium text-primary">Blog</Link>
            <Link href="/sign-in" className="text-muted-foreground hover:text-foreground transition-colors">Entrar</Link>
            <Link href="/sign-up" className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <header className="mb-10">
          <div className="flex items-center gap-2 text-sm text-primary font-medium mb-3">
            <Zap className="h-4 w-4" />
            Curadoria semanal por IA
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
            IA nos Negócios
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl">
            Toda segunda-feira, nosso agente varre as principais notícias sobre IA e escreve uma análise prática para gestores e empreendedores.
          </p>
        </header>

        {articles.length === 0 ? (
          <div className="text-center py-24 text-gray-400">
            <p className="text-lg">Em breve — primeiro post publicado toda segunda-feira.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {articles.map((article, idx) => (
              <article key={article.id} className={idx === 0 ? "border rounded-2xl p-8 bg-gray-50" : "border-b pb-8"}>
                {idx === 0 && (
                  <span className="inline-block text-xs bg-primary text-primary-foreground font-medium px-3 py-1 rounded-full mb-4">
                    Mais recente
                  </span>
                )}
                <Link href={`/blog/${article.slug}`} className="group">
                  <h2 className={`font-bold text-gray-900 group-hover:text-primary transition-colors leading-snug ${idx === 0 ? "text-2xl mb-3" : "text-xl mb-2"}`}>
                    {article.title}
                  </h2>
                </Link>
                {article.summary && (
                  <p className="text-gray-600 leading-relaxed mb-4 line-clamp-3">{article.summary}</p>
                )}
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex items-center gap-1.5 text-sm text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    {readingTime(article.content)} min de leitura
                  </span>
                  <span className="text-sm text-gray-400">{formatDate(article.created_at)}</span>
                  {article.tags && article.tags.split(",").slice(0, 2).map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                      <Tag className="h-3 w-3" />{tag.trim()}
                    </span>
                  ))}
                  <Link href={`/blog/${article.slug}`} className="ml-auto text-sm text-primary font-medium hover:underline">
                    Ler artigo →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t mt-20">
        <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-gray-400">
          <span>© 2026 Espaço IA — Todos os direitos reservados</span>
          <Link href="/" className="hover:text-gray-600 transition-colors">Conheça a plataforma →</Link>
        </div>
      </footer>
    </div>
  );
}
