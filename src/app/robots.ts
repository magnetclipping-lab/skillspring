import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/instructor", "/checkout", "/learn", "/api", "/auth", "/verify/"] }],
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
