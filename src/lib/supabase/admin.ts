import "server-only";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

let admin: SupabaseClient | null = null;

/**
 * Service-role client. BYPASSES Row Level Security.
 * Only for server code that has already authorised the caller: payment
 * fulfilment, webhooks, signed URLs, rate limiting, audit logging, email outbox.
 */
export function createAdminClient(): SupabaseClient {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.supabaseUrl || !key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  if (!admin) {
    admin = createSupabaseClient(publicEnv.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return admin;
}

export function hasAdminClient() {
  return Boolean(publicEnv.supabaseUrl && serverEnv().SUPABASE_SERVICE_ROLE_KEY);
}
