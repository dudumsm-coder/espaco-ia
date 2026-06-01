"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { knowledgeService } from "@/services/knowledge.service";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, Tag, Clock, ChevronRight, Cpu } from "lucide-react";
import { formatDate } from "@/lib/utils";

function readingTime(content: string): number {
  return Math.max(1, Math.round(content.split(" ").length / 200));
}

export default function ConhecimentoPage() {
  const router = useRouter();
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: knowledgeService.list,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog — IA nos Negócios</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Curadoria semanal de tendências e aplicações de inteligência artificial
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-3 py-1.5">
          <Cpu className="h-3.5 w-3.5 text-primary" />
          Atualizado toda segunda-feira
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <BookOpen className="h-12 w-12 mb-4 text-primary/20" />
          <p className="font-medium">Nenhum artigo publicado ainda</p>
          <p className="text-sm mt-1 text-center max-w-xs">
            O agente de blog publica automaticamente toda segunda-feira com as tendências da semana.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {articles.map((article, idx) => (
            <Card
              key={article.id}
              className="hover:shadow-md transition-all cursor-pointer group"
              onClick={() => router.push(`/conhecimento/${article.slug}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    {idx === 0 && (
                      <span className="inline-block text-xs bg-primary/10 text-primary font-medium px-2 py-0.5 rounded-full mb-2">
                        Mais recente
                      </span>
                    )}
                    <h2 className="text-lg font-bold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h2>
                    {article.summary && (
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-3 leading-relaxed">
                        {article.summary}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {readingTime(article.content)} min de leitura
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(article.created_at)}</span>
                      {article.tags && (
                        <div className="flex gap-1">
                          {article.tags.split(",").slice(0, 2).map(tag => (
                            <span key={tag} className="flex items-center gap-0.5 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                              <Tag className="h-2.5 w-2.5" />{tag.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-1 group-hover:text-primary transition-colors" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
