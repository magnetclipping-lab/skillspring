"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";

type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayInstance = { open: () => void; on: (event: string, cb: (r: { error: { description: string } }) => void) => void };
declare global {
  interface Window { Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance }
}

function loadScript(): Promise<boolean> {
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutButton({ slug, amountLabel, testMode }: { slug: string; amountLabel: string; testMode: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "starting" | "verifying" | "pending">("idle");
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    setError(null);
    setState("starting");
    if (!(await loadScript())) {
      setState("idle");
      return setError("Couldn't load Razorpay. Check your connection and try again.");
    }
    const res = await fetch("/api/payments/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseSlug: slug }) });
    const order = await res.json();
    if (!res.ok) {
      setState("idle");
      return setError(order.error ?? "Could not start checkout.");
    }
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.razorpayOrderId,
      amount: order.amount,
      currency: order.currency,
      name: "SkillSpring",
      description: order.courseTitle,
      prefill: order.prefill,
      theme: { color: "#3b45b8" },
      modal: { ondismiss: () => setState("idle") },
      handler: async (r: RazorpayResponse) => {
        setState("verifying");
        // The server verifies the signature and confirms with Razorpay before enrolling.
        const v = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
        const json = await v.json();
        if (v.ok && json.status === "paid") {
          router.replace(`/dashboard/learning/${slug}?welcome=1`);
        } else if (v.ok && json.status === "pending") {
          setState("pending");
        } else {
          setState("idle");
          setError(json.error ?? "We couldn't verify the payment.");
        }
      },
    });
    rzp.on("payment.failed", (r) => {
      setState("idle");
      setError(`Payment failed: ${r.error.description}. You have not been charged for a failed payment.`);
    });
    rzp.open();
    setState("idle");
  }

  if (state === "pending") {
    return <Alert tone="info" title="Payment is being confirmed">Razorpay hasn&apos;t confirmed the payment yet. You&apos;ll get access automatically once it does — check your dashboard in a few minutes.</Alert>;
  }

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button size="lg" className="w-full" onClick={pay} disabled={state !== "idle"}>
        {state === "idle" ? <Lock className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
        {state === "verifying" ? "Verifying payment…" : state === "starting" ? "Opening Razorpay…" : `Pay ${amountLabel}`}
      </Button>
      {testMode ? <p className="text-center text-[12px] font-medium text-amber-700">Razorpay test mode — use Razorpay test cards/UPI. No real money moves.</p> : null}
    </div>
  );
}
