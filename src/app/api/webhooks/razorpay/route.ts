import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { integrationStatus, serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, type RazorpayPayment, type RazorpayRefund } from "@/lib/payments/razorpay";
import { handleWebhookPayment } from "@/lib/payments/service";

export const runtime = "nodejs";

type Event = {
  event: string;
  payload: { payment?: { entity: RazorpayPayment }; refund?: { entity: RazorpayRefund }; order?: { entity: { id: string } } };
};

/**
 * Razorpay webhook (configure in Dashboard → Webhooks):
 *   events: payment.captured, payment.failed, order.paid, refund.created, refund.processed, refund.failed
 * Security: HMAC signature over the raw body; idempotency via webhook_events(provider, event_id).
 */
export async function POST(request: Request) {
  if (!integrationStatus().razorpayWebhook) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const raw = await request.text();
  if (raw.length > 1_000_000) return NextResponse.json({ error: "Payload too large" }, { status: 413 });
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyWebhookSignature(raw, signature, serverEnv().RAZORPAY_WEBHOOK_SECRET!)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventId = request.headers.get("x-razorpay-event-id") ?? createHash("sha256").update(raw).digest("hex");
  const admin = createAdminClient();

  const { data: inserted, error: insertError } = await admin
    .from("webhook_events")
    .insert({ provider: "razorpay", event_id: eventId, event_type: event.event, payload: event })
    .select("id")
    .single();
  let rowId = inserted?.id as string | undefined;
  if (insertError) {
    if (insertError.code !== "23505") return NextResponse.json({ error: "Storage error" }, { status: 500 });
    const { data: existing } = await admin.from("webhook_events").select("id, processed_at").eq("provider", "razorpay").eq("event_id", eventId).single();
    if (existing?.processed_at) return NextResponse.json({ ok: true, duplicate: true });
    rowId = existing?.id;
  }

  try {
    let result: unknown = { action: "ignored" };
    const payment = event.payload.payment?.entity;
    const refund = event.payload.refund?.entity;
    if ((event.event === "payment.captured" || event.event === "order.paid" || event.event === "payment.failed" || event.event === "payment.authorized") && payment) {
      result = await handleWebhookPayment(payment, event.event);
    } else if (event.event.startsWith("refund.") && refund) {
      const status = event.event === "refund.processed" ? "processed" : event.event === "refund.failed" ? "failed" : "pending";
      const { error } = await admin.rpc("apply_refund", {
        p_razorpay_payment_id: refund.payment_id,
        p_razorpay_refund_id: refund.id,
        p_amount_paise: refund.amount,
        p_status: status,
        p_reason: null,
        p_requested_by: null,
      });
      if (error) throw new Error(error.message);
      result = { action: `refund_${status}` };
    }
    await admin.from("webhook_events").update({ processed_at: new Date().toISOString(), error: null }).eq("id", rowId);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[webhook] processing failed", event.event, message);
    await admin.from("webhook_events").update({ error: message.slice(0, 1000) }).eq("id", rowId);
    // 500 → Razorpay retries with exponential backoff.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
