/**
 * Route-handler tests with external services mocked: webhook signature and
 * idempotency, and auth / CSRF guards on payment and upload endpoints.
 */
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "whsec_test_value_1234567890";
process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
process.env.RAZORPAY_KEY_SECRET = "secret_abc_123";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-for-tests-only";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";

// ---- fake service-role client -------------------------------------------------
const events = new Map<string, { id: string; processed_at: string | null }>();
const rpcCalls: { fn: string; args: unknown }[] = [];
function fakeAdmin() {
  return {
    rpc: vi.fn(async (fn: string, args: unknown) => { rpcCalls.push({ fn, args }); return { data: null, error: null }; }),
    from: (table: string) => {
      if (table !== "webhook_events") throw new Error("unexpected table " + table);
      return {
        insert: (row: { event_id: string }) => ({
          select: () => ({
            single: async () => {
              if (events.has(row.event_id)) return { data: null, error: { code: "23505", message: "duplicate" } };
              const r = { id: "evt-row-" + row.event_id, processed_at: null };
              events.set(row.event_id, r);
              return { data: { id: r.id }, error: null };
            },
          }),
        }),
        select: () => ({ eq: () => ({ eq: (_c: string, id: string) => ({ single: async () => ({ data: events.get(id) ?? null, error: null }) }) }) }),
        update: (patch: { processed_at?: string }) => ({
          eq: async (_c: string, rowId: string) => {
            for (const v of events.values()) if (v.id === rowId && patch.processed_at) v.processed_at = patch.processed_at;
            return { error: null };
          },
        }),
      };
    },
  };
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeAdmin(), hasAdminClient: () => true }));

const handleWebhookPayment = vi.fn(async () => ({ action: "enrolled" }));
vi.mock("@/lib/payments/service", () => ({
  handleWebhookPayment,
  createCheckoutOrder: vi.fn(async () => ({ razorpayOrderId: "order_1" })),
  verifyCheckoutPayment: vi.fn(),
  PaymentError: class PaymentError extends Error { status = 400; },
}));

let sessionUser: unknown = null;
vi.mock("@/lib/auth/dal", () => ({ getSessionUser: async () => sessionUser }));
vi.mock("@/lib/security/rate-limit", () => ({ rateLimit: async () => ({ ok: true }) }));

const sign = (body: string) => createHmac("sha256", SECRET).update(body).digest("hex");
const payload = (event: string, id = "pay_1") => JSON.stringify({ event, payload: { payment: { entity: { id, order_id: "order_1", amount: 49900, currency: "INR", status: event === "payment.failed" ? "failed" : "captured" } } } });

describe("POST /api/webhooks/razorpay", () => {
  beforeEach(() => { handleWebhookPayment.mockClear(); rpcCalls.length = 0; });

  it("rejects requests without a valid signature", async () => {
    const { POST } = await import("@/app/api/webhooks/razorpay/route");
    const body = payload("payment.captured");
    const res = await POST(new Request("http://x/api/webhooks/razorpay", { method: "POST", body, headers: { "x-razorpay-signature": "0".repeat(64) } }));
    expect(res.status).toBe(401);
    expect(handleWebhookPayment).not.toHaveBeenCalled();
  });

  it("processes a signed payment.captured event once, ignoring replays", async () => {
    const { POST } = await import("@/app/api/webhooks/razorpay/route");
    const body = payload("payment.captured");
    const req = () => new Request("http://x/api/webhooks/razorpay", { method: "POST", body, headers: { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_1" } });
    const first = await POST(req());
    expect(first.status).toBe(200);
    const second = await POST(req());
    expect(await second.json()).toMatchObject({ duplicate: true });
    expect(handleWebhookPayment).toHaveBeenCalledTimes(1);
  });

  it("records refunds via apply_refund", async () => {
    const { POST } = await import("@/app/api/webhooks/razorpay/route");
    const body = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 49900, status: "processed" } } } });
    const res = await POST(new Request("http://x/api/webhooks/razorpay", { method: "POST", body, headers: { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_r1" } }));
    expect(res.status).toBe(200);
    expect(rpcCalls).toContainEqual({ fn: "apply_refund", args: expect.objectContaining({ p_razorpay_refund_id: "rfnd_1", p_status: "processed" }) });
  });
});

describe("POST /api/payments/create-order", () => {
  it("blocks cross-origin requests", async () => {
    const { POST } = await import("@/app/api/payments/create-order/route");
    const res = await POST(new Request("http://localhost:3000/api/payments/create-order", { method: "POST", headers: { origin: "https://evil.example", host: "localhost:3000" }, body: "{}" }));
    expect(res.status).toBe(403);
  });
  it("requires a signed-in user", async () => {
    sessionUser = null;
    const { POST } = await import("@/app/api/payments/create-order/route");
    const res = await POST(new Request("http://localhost:3000/api/payments/create-order", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" }, body: JSON.stringify({ courseSlug: "x" }) }));
    expect(res.status).toBe(401);
  });
  it("rejects suspended accounts and malformed input", async () => {
    const { POST } = await import("@/app/api/payments/create-order/route");
    sessionUser = { id: "u", email: "u@x.in", profile: { is_suspended: true, full_name: "U" } };
    const suspended = await POST(new Request("http://localhost:3000/api/payments/create-order", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" }, body: JSON.stringify({ courseSlug: "x" }) }));
    expect(suspended.status).toBe(403);
    sessionUser = { id: "u", email: "u@x.in", profile: { is_suspended: false, full_name: "U" } };
    const bad = await POST(new Request("http://localhost:3000/api/payments/create-order", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" }, body: JSON.stringify({ courseSlug: "../../etc", price: 1 }) }));
    expect(bad.status).toBe(400);
  });
});

describe("POST /api/payments/verify", () => {
  it("rejects malformed Razorpay responses before any processing", async () => {
    sessionUser = { id: "u", email: "u@x.in", profile: { is_suspended: false, full_name: "U" } };
    const { POST } = await import("@/app/api/payments/verify/route");
    const res = await POST(new Request("http://localhost:3000/api/payments/verify", { method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000" }, body: JSON.stringify({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "not-hex" }) }));
    expect(res.status).toBe(400);
  });
});
