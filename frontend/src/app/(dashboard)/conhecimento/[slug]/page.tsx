"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { knowledgeService } from "@/services/knowledge.service";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Tag, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function readingTime(content: string): number {
  return Math.max(1, Math.round(content.split(" ").length / 200));
}

export default function ArtigoPage({ params }: { params: { slug: string } }) {
  const router = useRouter();

  const { data: article, isLoading, error } = useQuery({
    queryKey: ["article", params.slug],
    queryFn: () => knowledgeService.get(params.slug),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-12 bg-muted rounded animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24">
        <p className="text-muted-foreground">Artigo não encontrado.</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/conhecimento")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao blog
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" className="-ml-2 text-muted-foreground" onClick={() => router.push("/conhecimento")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao blog
      </Button>

      <article>
        <header className="space-y-4 mb-8">
          <h1 className="text-3xl font-bold leading-tight">{article.title}</h1>

          {article.summary && (
            <p className="text-lg text-muted-foreground leading-relaxed border-l-4 border-primary/30 pl-4">
              {article.summary}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {formatDate(article.created_at)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {readingTime(article.content)} min de leitura
            </span>
            {article.tags && (
              <div className="flex gap-1.5 flex-wrap">
                {article.tags.split(",").map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
                    <Tag className="h-3 w-3" />{tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border-b" />
        </header>

        <div className="prose prose-neutral max-w-none
          prose-headings:font-bold prose-headings:text-foreground
          prose-h1:text-2xl prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4
          prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:mb-4
          prose-li:text-foreground/90 prose-li:leading-relaxed
          prose-strong:text-foreground prose-strong:font-semibold
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-blockquote:border-l-primary/30 prose-blockquote:text-muted-foreground
          prose-hr:border-border">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {article.content}
          </ReactMarkdown>
        </div>
      </article>
    </div>
  );
}
