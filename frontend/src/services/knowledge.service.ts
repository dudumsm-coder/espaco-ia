import api from "@/lib/api";

export interface Article {
  id: number;
  title: string;
  slug: string;
  content: string;
  summary: string | null;
  tags: string | null;
  published: boolean;
  created_at: string;
}

export const knowledgeService = {
  list: () => api.get<Article[]>("/knowledge").then(r => r.data),
  get: (slug: string) => api.get<Article>(`/knowledge/${slug}`).then(r => r.data),
};
