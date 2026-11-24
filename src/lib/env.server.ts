import "server-only";
import { serverEnvSchema } from "./env";

let cached: ReturnType<typeof serverEnvSchema.parse> | null = null;

/** Server-only secrets. Never import this file from a client component. */
export function serverEnv() {
  if (!cached) cached = serverEnvSchema.parse(process.env);
  return cached;
}

const placeholder = (v?: string) => !v || /^(your|replace|xxx|changeme)/i.test(v) || v.includes("placeholder");

export function integrationStatus() {
  const e = serverEnv();
  return {
    supabaseAdmin: !placeholder(e.SUPABASE_SERVICE_ROLE_KEY),
    razorpay: !placeholder(e.RAZORPAY_KEY_ID) && !placeholder(e.RAZORPAY_KEY_SECRET),
    razorpayWebhook: !placeholder(e.RAZORPAY_WEBHOOK_SECRET),
    razorpayLiveMode: (e.RAZORPAY_KEY_ID ?? "").startsWith("rzp_live_"),
    email: !placeholder(e.RESEND_API_KEY) && !placeholder(e.EMAIL_FROM),
    anthropic: !placeholder(e.ANTHROPIC_API_KEY),
    mux: !placeholder(e.MUX_SIGNING_KEY_ID) && !placeholder(e.MUX_SIGNING_PRIVATE_KEY),
    muxUploads: !placeholder(e.MUX_TOKEN_ID) && !placeholder(e.MUX_TOKEN_SECRET),
    cloudflareStream: !placeholder(e.CLOUDFLARE_STREAM_CUSTOMER_CODE) && !placeholder(e.CLOUDFLARE_STREAM_KEY_ID) && !placeholder(e.CLOUDFLARE_STREAM_PRIVATE_KEY),
  };
}
