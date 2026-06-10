import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://espaco-ia.com.br";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/blog/"],
        disallow: ["/dashboard/", "/admin/", "/api/", "/chat/", "/engenharia/", "/creditos/"],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
