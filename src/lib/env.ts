import { z } from "zod";

/**
 * Environment access. Public values are inlined at build time; server values are
 * read lazily and never imported into client components (see lib/env.server.ts).
 */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/(rest\/v1\/?)?$/, ""),
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim(),
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@skillspring.example",
};

/** True when Supabase URL + anon key are present. Otherwise the app runs in preview mode. */
export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey && !publicEnv.supabaseUrl.includes("your-project"));
}

// Trim pasted values (dashboards often add a trailing space/newline, which breaks HTTP headers).
const opt = () => z.string().optional().transform((v) => (v?.trim() ? v.trim() : undefined));

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: opt(),
  RAZORPAY_KEY_ID: opt(),
  RAZORPAY_KEY_SECRET: opt(),
  RAZORPAY_WEBHOOK_SECRET: opt(),
  RESEND_API_KEY: opt(),
  EMAIL_FROM: opt(),
  MUX_SIGNING_KEY_ID: opt(),
  MUX_SIGNING_PRIVATE_KEY: opt(),
  MUX_TOKEN_ID: opt(),
  MUX_TOKEN_SECRET: opt(),
  CLOUDFLARE_STREAM_CUSTOMER_CODE: opt(),
  CLOUDFLARE_STREAM_KEY_ID: opt(),
  CLOUDFLARE_STREAM_PRIVATE_KEY: opt(),
  RATE_LIMIT_SALT: opt(),
});
