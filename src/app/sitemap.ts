import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { getCategories, getPublishedCourses } from "@/lib/data/catalogue";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const [courses, categories] = await Promise.all([getPublishedCourses().catch(() => []), getCategories().catch(() => [])]);
  const statics = ["", "/courses", "/about", "/faq", "/contact", "/campus-ambassador", "/become-instructor", "/privacy", "/terms", "/refund-policy", "/disclaimer"];
  return [
    ...statics.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : p === "/courses" ? 0.9 : 0.5 })),
    ...categories.map((c) => ({ url: `${base}/courses?category=${c.slug}`, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...courses.map((c) => ({ url: `${base}/courses/${c.slug}`, lastModified: c.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
  ];
}
