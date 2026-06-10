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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const knowledgeService = {
  list: () => api.get<Article[]>("/knowledge").then(r => r.data),
  get: (slug: string) => api.get<Article>(`/knowledge/${slug}`).then(r => r.data),
};

// Server-side sem token (para SEO / páginas públicas)
export async function fetchArticlesPublic(): Promise<Article[]> {
  const res = await fetch(`${API_BASE}/knowledge`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchArticlePublic(slug: string): Promise<Article | null> {
  const res = await fetch(`${API_BASE}/knowledge/${slug}`, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  return res.json();
}
