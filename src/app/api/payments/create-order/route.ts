import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { createCheckoutOrder, PaymentError } from "@/lib/payments/service";
import { isSameOrigin } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { RazorpayError } from "@/lib/payments/razorpay";

const body = z.object({ courseSlug: z.string().regex(/^[a-z0-9-]{1,80}$/) });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in to continue." }, { status: 401 });
  if (user.profile.is_suspended) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  if (!(await rateLimit("createOrder", user.id)).ok) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });

  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  try {
    // Price and availability are decided on the server from the database.
    const order = await createCheckoutOrder({ id: user.id, email: user.email, name: user.profile.full_name, phone: user.profile.phone }, parsed.data.courseSlug);
    return NextResponse.json(order);
  } catch (e) {
    if (e instanceof PaymentError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof RazorpayError) {
      console.error("[payments] razorpay order error", e.status, e.message);
      return NextResponse.json({ error: "The payment gateway is unavailable. Please try again." }, { status: 502 });
    }
    console.error("[payments] create-order failed", e);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
