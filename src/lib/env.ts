import { z } from "zod";

/**
 * Environment access. Public values are inlined at build time; server values are
 * read lazily and never imported into client components (see lib/env.server.ts).
 */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@skillspring.example",
};

/** True when Supabase URL + anon key are present. Otherwise the app runs in preview mode. */
export function isSupabaseConfigured() {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey && !publicEnv.supabaseUrl.includes("your-project"));
}

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  MUX_SIGNING_KEY_ID: z.string().optional(),
  MUX_SIGNING_PRIVATE_KEY: z.string().optional(),
  MUX_TOKEN_ID: z.string().optional(),
  MUX_TOKEN_SECRET: z.string().optional(),
  CLOUDFLARE_STREAM_CUSTOMER_CODE: z.string().optional(),
  CLOUDFLARE_STREAM_KEY_ID: z.string().optional(),
  CLOUDFLARE_STREAM_PRIVATE_KEY: z.string().optional(),
  RATE_LIMIT_SALT: z.string().optional(),
});
