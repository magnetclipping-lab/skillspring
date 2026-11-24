import "server-only";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { clientIp, hashKey } from "./request";

export const LIMITS = {
  login: { max: 8, windowSeconds: 15 * 60 },
  register: { max: 5, windowSeconds: 60 * 60 },
  passwordReset: { max: 5, windowSeconds: 60 * 60 },
  contact: { max: 5, windowSeconds: 60 * 60 },
  createOrder: { max: 15, windowSeconds: 10 * 60 },
  verifyPayment: { max: 30, windowSeconds: 10 * 60 },
  apply: { max: 20, windowSeconds: 60 * 60 },
  ambassador: { max: 3, windowSeconds: 60 * 60 },
  upload: { max: 40, windowSeconds: 60 * 60 },
  verifyCertificate: { max: 60, windowSeconds: 10 * 60 },
  quiz: { max: 30, windowSeconds: 10 * 60 },
  submission: { max: 20, windowSeconds: 60 * 60 },
  template: { max: 60, windowSeconds: 60 * 60 },
  adminEvaluate: { max: 10, windowSeconds: 10 * 60 },
} as const;

export type LimitName = keyof typeof LIMITS;

/**
 * Fixed-window rate limit stored in Postgres (private.rate_limits) so it works
 * across serverless instances without extra infrastructure.
 * Fails open only when the database is unreachable/unconfigured, and logs it.
 */
export async function rateLimit(name: LimitName, identity?: string): Promise<{ ok: boolean }> {
  if (!hasAdminClient()) return { ok: true };
  const { max, windowSeconds } = LIMITS[name];
  const key = `${name}:${hashKey(identity ?? (await clientIp()))}`;
  const { data, error } = await createAdminClient().rpc("check_rate_limit", {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("[rate-limit] check failed", error.message);
    return { ok: true };
  }
  return { ok: data === true };
}
