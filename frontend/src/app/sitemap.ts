import type { MetadataRoute } from "next";
import { fetchArticlesPublic } from "@/services/knowledge.service";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://espaco-ia.com.br";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const articles = await fetchArticlesPublic();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE_URL}/sign-in`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/sign-up`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map(a => ({
    url: `${BASE_URL}/blog/${a.slug}`,
    lastModified: new Date(a.created_at),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  return [...staticRoutes, ...articleRoutes];
}
