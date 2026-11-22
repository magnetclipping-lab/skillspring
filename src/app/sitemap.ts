import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { getInternships, getPublishedCourses } from "@/lib/data/catalogue";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const [courses, internships] = await Promise.all([getPublishedCourses().catch(() => []), getInternships().catch(() => [])]);
  const statics = ["", "/programs", "/campus-ambassador", "/internships", "/about", "/contact", "/become-instructor", "/partners", "/faq", "/verify", "/privacy", "/terms", "/refund-policy", "/disclaimer"];
  return [
    ...statics.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.6 })),
    ...courses.map((c) => ({ url: `${base}/programs/${c.slug}`, lastModified: c.updated_at, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...internships.filter((i) => i.status === "open").map((i) => ({ url: `${base}/internships/${i.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
