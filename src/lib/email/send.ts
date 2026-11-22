import "server-only";
import { integrationStatus, serverEnv } from "@/lib/env.server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { renderTemplate, type TemplateName } from "./templates";

/**
 * Sends a transactional email through Resend and records it in email_outbox.
 * When no provider is configured the email is recorded with status "skipped" —
 * nothing is sent and nothing is reported as delivered.
 * Auth emails (verification, password reset) are sent by Supabase Auth itself;
 * configure Resend as Supabase's custom SMTP provider for consistent branding.
 */
export async function sendTemplateEmail(p: { to: string; template: TemplateName; data: Record<string, string | undefined>; dedupeKey?: string }) {
  const { subject, html } = renderTemplate(p.template, p.data);
  const admin = hasAdminClient() ? createAdminClient() : null;

  let outboxId: string | null = null;
  if (admin) {
    const { data, error } = await admin
      .from("email_outbox")
      .insert({ to_email: p.to, template: p.template, subject, dedupe_key: p.dedupeKey ?? null })
      .select("id")
      .single();
    if (error?.code === "23505") return { status: "duplicate" as const };
    outboxId = data?.id ?? null;
  }

  const finish = async (fields: Record<string, unknown>) => {
    if (admin && outboxId) await admin.from("email_outbox").update(fields).eq("id", outboxId);
  };

  if (!integrationStatus().email) {
    console.info(`[email] provider not configured — skipped "${p.template}" to ${p.to.replace(/(.).+@/, "$1***@")}`);
    await finish({ status: "skipped", error: "Email provider not configured" });
    return { status: "skipped" as const };
  }

  try {
    const env = serverEnv();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [p.to], subject, html }),
      signal: AbortSignal.timeout(10000),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) throw new Error(json.message ?? `Resend error ${res.status}`);
    await finish({ status: "sent", provider_message_id: json.id ?? null, sent_at: new Date().toISOString() });
    return { status: "sent" as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[email] send failed", message);
    await finish({ status: "failed", error: message.slice(0, 500) });
    return { status: "failed" as const };
  }
}
