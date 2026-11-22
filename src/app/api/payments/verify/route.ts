import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { PaymentError, verifyCheckoutPayment } from "@/lib/payments/service";
import { isSameOrigin } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";

const body = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
});

/** Called by the browser after Razorpay Checkout succeeds. Nothing is trusted until verified here. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!(await rateLimit("verifyPayment", user.id)).ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });

  try {
    const result = await verifyCheckoutPayment(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("[payments] verify failed", e);
    return NextResponse.json({ error: "We couldn't confirm your payment yet. If money was deducted, access will be granted automatically once Razorpay confirms it." }, { status: 500 });
  }
}
