"use client";
import { useQuery } from "@tanstack/react-query";
import { knowledgeService } from "@/services/knowledge.service";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Tag } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function ConhecimentoPage() {
  const { data: articles = [], isLoading } = useQuery({
    queryKey: ["knowledge"],
    queryFn: knowledgeService.list,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Base de Conhecimento</h1>
        <p className="text-muted-foreground text-sm mt-1">Artigos e guias sobre IA e transformação digital</p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Carregando artigos...</p>
      ) : articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <BookOpen className="h-12 w-12 mb-4 text-primary/30" />
          <p className="font-medium">Nenhum artigo publicado ainda</p>
          <p className="text-sm mt-1">Em breve novos conteúdos sobre IA.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map(article => (
            <Card key={article.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-base leading-snug">{article.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{formatDate(article.created_at)}</p>
              </CardHeader>
              <CardContent>
                {article.summary && <p className="text-sm text-muted-foreground line-clamp-3">{article.summary}</p>}
                {article.tags && (
                  <div className="flex gap-1 flex-wrap mt-3">
                    {article.tags.split(",").map(tag => (
                      <span key={tag} className="flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                        <Tag className="h-2.5 w-2.5" />{tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
