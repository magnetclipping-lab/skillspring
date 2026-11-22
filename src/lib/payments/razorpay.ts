import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Razorpay helpers. Signature checks are pure functions (unit tested).
 * API calls use Razorpay's REST API with Basic auth — no secret ever reaches the browser.
 * Docs: https://razorpay.com/docs/api/
 */

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout callback: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(params: { orderId: string; paymentId: string; signature: string; secret: string }) {
  const { orderId, paymentId, signature, secret } = params;
  if (!orderId || !paymentId || !signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook: HMAC_SHA256(raw request body, webhook_secret) in X-Razorpay-Signature. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string; status: string };
export type RazorpayPayment = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method?: string;
  error_code?: string | null;
  error_description?: string | null;
  email?: string;
};
export type RazorpayRefund = { id: string; payment_id: string; amount: number; status: "pending" | "processed" | "failed" };

export class RazorpayError extends Error {
  constructor(message: string, public status: number, public body?: unknown) {
    super(message);
  }
}

export function createRazorpayClient(keyId: string, keySecret: string, fetchImpl: typeof fetch = fetch) {
  const auth = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    const res = await fetchImpl(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { error?: { description?: string } })?.error?.description ?? `Razorpay request failed (${res.status})`;
      throw new RazorpayError(msg, res.status, json);
    }
    return json as T;
  }
  return {
    createOrder: (p: { amount: number; receipt: string; notes: Record<string, string> }) =>
      call<RazorpayOrder>("POST", "/orders", { amount: p.amount, currency: "INR", receipt: p.receipt, notes: p.notes }),
    fetchPayment: (paymentId: string) => call<RazorpayPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`),
    capturePayment: (paymentId: string, amount: number) =>
      call<RazorpayPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency: "INR" }),
    refundPayment: (paymentId: string, amount: number, notes: Record<string, string>) =>
      call<RazorpayRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, { amount, notes, speed: "normal" }),
  };
}
