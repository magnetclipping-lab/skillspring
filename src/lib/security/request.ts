import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/** Client IP as reported by the platform proxy (Vercel sets x-forwarded-for). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** Hash identifiers before using them as rate-limit keys so raw IPs are never stored. */
export function hashKey(value: string) {
  return createHash("sha256").update((serverEnv().RATE_LIMIT_SALT ?? "skillspring") + ":" + value).digest("hex").slice(0, 32);
}

/**
 * CSRF defence for JSON route handlers: require a same-origin Origin header.
 * (Server Actions already enforce this in Next.js.)
 */
export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (host && o.host === host) return true;
    return o.origin === new URL(publicEnv.siteUrl).origin;
  } catch {
    return false;
  }
}
