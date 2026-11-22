import "server-only";
import { randomBytes } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { integrationStatus, serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpayClient, verifyCheckoutSignature, type RazorpayPayment } from "./razorpay";
import { sendTemplateEmail } from "@/lib/email/send";
import { formatINR } from "@/lib/utils";

export class PaymentError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function razorpay() {
  const e = serverEnv();
  if (!integrationStatus().razorpay) throw new PaymentError("Payments are not configured yet. Please try again later.", 503);
  return createRazorpayClient(e.RAZORPAY_KEY_ID!, e.RAZORPAY_KEY_SECRET!);
}

/**
 * Step 2–3 of checkout: the server decides availability and price from the
 * database (never from the client) and creates a Razorpay order.
 */
export async function createCheckoutOrder(user: { id: string; email: string; name: string; phone?: string | null }, courseSlug: string) {
  const admin = createAdminClient();
  const { data: course } = await admin.from("courses").select("id, slug, title").eq("slug", courseSlug).maybeSingle();
  if (!course) throw new PaymentError("Course not found.", 404);

  const [{ data: purchasable }, { data: price }, { data: existing }] = await Promise.all([
    admin.rpc("course_is_purchasable", { p_course_id: course.id }),
    admin.rpc("course_effective_price", { p_course_id: course.id }),
    admin.from("enrolments").select("id, status").eq("user_id", user.id).eq("course_id", course.id).maybeSingle(),
  ]);
  if (!purchasable) throw new PaymentError("This course is not available for purchase yet.", 409);
  if (existing?.status === "active") throw new PaymentError("You are already enrolled in this course.", 409);
  if (existing?.status === "revoked") throw new PaymentError("Your access to this course was revoked. Please contact support.", 403);
  const amount = Number(price);
  if (!Number.isInteger(amount) || amount < 100) throw new PaymentError("This course cannot be purchased online.", 409);

  const rzp = razorpay();
  const receipt = `ss_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const { data: order, error } = await admin
    .from("orders")
    .insert({ user_id: user.id, course_id: course.id, amount_paise: amount, receipt, notes: { course_slug: course.slug } })
    .select("id")
    .single();
  if (error || !order) throw new PaymentError("Could not create order.", 500);

  const rzpOrder = await rzp.createOrder({ amount, receipt, notes: { order_id: order.id, user_id: user.id, course_id: course.id } });
  await admin.from("orders").update({ razorpay_order_id: rzpOrder.id }).eq("id", order.id);

  return {
    keyId: serverEnv().RAZORPAY_KEY_ID!,
    razorpayOrderId: rzpOrder.id,
    amount,
    currency: "INR",
    courseTitle: course.title,
    prefill: { name: user.name, email: user.email, contact: user.phone ?? undefined },
  };
}

type FulfilResult = { enrolment_id: string; newly_enrolled: boolean; user_id: string; course_id: string; order_id: string };

async function fulfil(payment: RazorpayPayment, signature: string | null, via: "checkout_signature" | "webhook") {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("fulfil_order", {
    p_razorpay_order_id: payment.order_id,
    p_razorpay_payment_id: payment.id,
    p_signature: signature,
    p_amount_paise: payment.amount,
    p_method: payment.method ?? null,
    p_verified_via: via,
    p_raw: payment as unknown as Record<string, unknown>,
  });
  if (error) throw new PaymentError(`Fulfilment failed: ${error.message}`, 500);
  const result = data as FulfilResult;
  if (result.newly_enrolled) await sendEnrolmentEmails(result, payment.amount);
  return result;
}

/**
 * Steps 6 + 8: verify the checkout signature server-side, confirm the payment
 * status directly with Razorpay, then enrol. Frontend "success" is never trusted.
 */
export async function verifyCheckoutPayment(userId: string, p: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  const e = serverEnv();
  if (!integrationStatus().razorpay) throw new PaymentError("Payments are not configured.", 503);
  const valid = verifyCheckoutSignature({ orderId: p.razorpay_order_id, paymentId: p.razorpay_payment_id, signature: p.razorpay_signature, secret: e.RAZORPAY_KEY_SECRET! });
  if (!valid) throw new PaymentError("Payment signature verification failed.", 400);

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, user_id, amount_paise, course_id, status").eq("razorpay_order_id", p.razorpay_order_id).maybeSingle();
  if (!order || order.user_id !== userId) throw new PaymentError("Order not found.", 404);

  const rzp = razorpay();
  let payment = await rzp.fetchPayment(p.razorpay_payment_id);
  if (payment.order_id !== p.razorpay_order_id) throw new PaymentError("Payment does not belong to this order.", 400);
  if (payment.status === "authorized") payment = await rzp.capturePayment(payment.id, order.amount_paise);
  if (payment.status !== "captured") {
    await admin.rpc("mark_order_attempted", { p_razorpay_order_id: p.razorpay_order_id });
    return { status: "pending" as const };
  }
  const result = await fulfil(payment, p.razorpay_signature, "checkout_signature");
  return { status: "paid" as const, ...result };
}

/** Webhook path (step 7). Idempotent: safe to receive the same event many times. */
export async function handleWebhookPayment(payment: RazorpayPayment, eventType: string) {
  const admin = createAdminClient();
  if (eventType === "payment.failed") {
    await admin.rpc("mark_order_failed", {
      p_razorpay_order_id: payment.order_id,
      p_razorpay_payment_id: payment.id,
      p_error_code: payment.error_code ?? null,
      p_error_description: payment.error_description ?? null,
      p_raw: payment as unknown as Record<string, unknown>,
    });
    return { action: "failed" };
  }
  if (payment.status === "captured") {
    const r = await fulfil(payment, null, "webhook");
    return { action: r.newly_enrolled ? "enrolled" : "already_fulfilled" };
  }
  if (payment.status === "authorized") {
    await admin.rpc("mark_order_attempted", { p_razorpay_order_id: payment.order_id });
    return { action: "authorized" };
  }
  return { action: "ignored" };
}

export async function initiateRefund(adminUserId: string, paymentId: string, amountPaise: number, reason: string) {
  const admin = createAdminClient();
  const { data: pay } = await admin.from("payments").select("id, razorpay_payment_id, amount_paise, status").eq("id", paymentId).maybeSingle();
  if (!pay) throw new PaymentError("Payment not found.", 404);
  if (!["captured", "partially_refunded"].includes(pay.status)) throw new PaymentError("Only captured payments can be refunded.", 409);
  const { data: prior } = await admin.from("refunds").select("amount_paise, status").eq("payment_id", pay.id);
  const already = (prior ?? []).filter((r) => r.status !== "failed" && r.status !== "rejected").reduce((s, r) => s + r.amount_paise, 0);
  if (amountPaise <= 0 || amountPaise + already > pay.amount_paise) throw new PaymentError("Refund amount exceeds the refundable balance.", 400);

  const refund = await razorpay().refundPayment(pay.razorpay_payment_id, amountPaise, { reason: reason.slice(0, 200), initiated_by: adminUserId });
  const { error } = await admin.rpc("apply_refund", {
    p_razorpay_payment_id: pay.razorpay_payment_id,
    p_razorpay_refund_id: refund.id,
    p_amount_paise: refund.amount,
    p_status: refund.status === "processed" ? "processed" : refund.status === "failed" ? "failed" : "pending",
    p_reason: reason,
    p_requested_by: adminUserId,
  });
  if (error) throw new PaymentError(error.message, 500);
  return refund;
}

async function sendEnrolmentEmails(r: FulfilResult, amount: number) {
  const admin = createAdminClient();
  const [{ data: profile }, { data: course }] = await Promise.all([
    admin.from("profiles").select("full_name, email").eq("id", r.user_id).single(),
    admin.from("courses").select("title, slug").eq("id", r.course_id).single(),
  ]);
  if (!profile?.email || !course) return;
  await sendTemplateEmail({
    to: profile.email,
    template: "payment_success",
    dedupeKey: `payment:${r.order_id}`,
    data: { name: profile.full_name, courseTitle: course.title, amount: formatINR(amount, true), url: `${publicEnv.siteUrl}/dashboard/learning/${course.slug}` },
  });
}
