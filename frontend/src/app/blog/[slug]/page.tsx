import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchArticlePublic, fetchArticlesPublic } from "@/services/knowledge.service";
import { Clock, Tag, ArrowLeft, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props { params: { slug: string } }

function readingTime(content: string) {
  return Math.max(1, Math.round(content.split(" ").length / 200));
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(dateStr));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await fetchArticlePublic(params.slug);
  if (!article) return { title: "Artigo não encontrado | Espaço IA" };

  return {
    title: `${article.title} | Espaço IA`,
    description: article.summary ?? `Leia sobre: ${article.title}`,
    openGraph: {
      title: article.title,
      description: article.summary ?? "",
      type: "article",
      publishedTime: article.created_at,
      siteName: "Espaço IA",
      tags: article.tags?.split(",").map(t => t.trim()),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.summary ?? "",
    },
    alternates: { canonical: `/blog/${params.slug}` },
  };
}

export async function generateStaticParams() {
  const articles = await fetchArticlesPublic();
  return articles.map(a => ({ slug: a.slug }));
}

export default async function BlogArtigoPage({ params }: Props) {
  const article = await fetchArticlePublic(params.slug);
  if (!article) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    datePublished: article.created_at,
    author: { "@type": "Organization", name: "Espaço IA" },
    publisher: { "@type": "Organization", name: "Espaço IA", url: "https://espaco-ia.com.br" },
    keywords: article.tags,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="min-h-screen bg-white">
        {/* Nav */}
        <nav className="border-b sticky top-0 bg-white/90 backdrop-blur z-10">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg">
              <Zap className="h-5 w-5 text-primary" />
              Espaço IA
            </Link>
            <div className="flex items-center gap-4 text-sm">
              <Link href="/blog" className="text-muted-foreground hover:text-foreground transition-colors">Blog</Link>
              <Link href="/sign-up" className="bg-primary text-primary-foreground px-4 py-1.5 rounded-full text-sm font-medium hover:bg-primary/90 transition-colors">
                Começar grátis
              </Link>
            </div>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-6 py-12">
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary transition-colors mb-8">
            <ArrowLeft className="h-4 w-4" /> Voltar ao blog
          </Link>

          <article>
            <header className="mb-10">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight mb-6">
                {article.title}
              </h1>

              {article.summary && (
                <p className="text-xl text-gray-500 leading-relaxed border-l-4 border-primary/40 pl-5 mb-6">
                  {article.summary}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400 pb-6 border-b">
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {readingTime(article.content)} min de leitura
                </span>
                <span>{formatDate(article.created_at)}</span>
                <span className="flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-primary" />
                  Gerado por IA com curadoria de notícias
                </span>
                {article.tags && article.tags.split(",").map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                    <Tag className="h-3 w-3" />{tag.trim()}
                  </span>
                ))}
              </div>
            </header>

            <div className="prose prose-lg prose-gray max-w-none
              prose-headings:font-bold prose-headings:text-gray-900
              prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
              prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-5
              prose-li:text-gray-700 prose-li:leading-relaxed
              prose-strong:text-gray-900 prose-strong:font-semibold
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-blockquote:border-l-primary/40 prose-blockquote:text-gray-500 prose-blockquote:italic
              prose-hr:border-gray-200">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {article.content}
              </ReactMarkdown>
            </div>
          </article>

          {/* CTA */}
          <div className="mt-16 rounded-2xl bg-primary/5 border border-primary/20 p-8 text-center">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Quer implementar IA no seu negócio?
            </h3>
            <p className="text-gray-600 mb-6">
              Use nosso sistema de engenharia de requisitos para documentar seu projeto com agentes de IA.
            </p>
            <Link href="/sign-up" className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-full font-medium hover:bg-primary/90 transition-colors">
              Começar gratuitamente →
            </Link>
          </div>
        </main>

        <footer className="border-t mt-12">
          <div className="max-w-4xl mx-auto px-6 py-8 flex items-center justify-between text-sm text-gray-400">
            <span>© 2026 Espaço IA</span>
            <div className="flex gap-4">
              <Link href="/blog" className="hover:text-gray-600">Blog</Link>
              <Link href="/" className="hover:text-gray-600">Plataforma</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
