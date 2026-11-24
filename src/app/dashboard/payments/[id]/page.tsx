import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { LogoGlyph, Wordmark } from "@/components/site/logo";
import { publicEnv } from "@/lib/env";
import { formatDate, formatINR, titleCase } from "@/lib/utils";
import { PrintButton } from "./print-button";

export const metadata = { title: "Receipt", robots: { index: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const user = await requireUser(`/dashboard/payments/${id}`);
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, receipt, amount_paise, currency, status, created_at, paid_at, razorpay_order_id, course:courses(title, slug), payments(razorpay_payment_id, method, status, created_at), refunds(amount_paise, status, processed_at)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  type O = { id: string; receipt: string; amount_paise: number; currency: string; status: string; created_at: string; paid_at: string | null; razorpay_order_id: string | null;
    course: { title: string; slug: string } | null; payments: { razorpay_payment_id: string; method: string | null; status: string; created_at: string }[]; refunds: { amount_paise: number; status: string; processed_at: string | null }[] };
  const o = data as unknown as O | null;
  if (!o || !["paid", "refunded", "partially_refunded"].includes(o.status)) notFound();
  const pay = o.payments.find((p) => p.status === "captured") ?? o.payments[0];
  const refunded = o.refunds.filter((r) => r.status === "processed").reduce((n, r) => n + r.amount_paise, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/dashboard/payments" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 hover:underline"><ArrowLeft className="size-4" />Payments</Link>
        <PrintButton />
      </div>
      <article className="rounded-xl border border-line bg-surface p-8 print:border-0 print:p-0">
        <header className="flex items-start justify-between gap-6 border-b border-line pb-6">
          <div className="flex items-center gap-2"><LogoGlyph /><Wordmark /></div>
          <div className="text-right">
            <p className="font-display text-xl font-semibold">Payment receipt</p>
            <p className="mt-1 font-mono text-[12.5px] text-ink-muted">{o.receipt}</p>
          </div>
        </header>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 py-6 text-sm">
          <div><dt className="text-ink-muted">Billed to</dt><dd className="mt-1 font-medium">{user.profile.full_name || "—"}</dd><dd className="text-ink-soft">{user.email}</dd></div>
          <div><dt className="text-ink-muted">Date paid</dt><dd className="mt-1 font-medium">{formatDate(o.paid_at ?? pay?.created_at ?? o.created_at)}</dd></div>
          <div><dt className="text-ink-muted">Payment method</dt><dd className="mt-1 font-medium">{pay?.method ? titleCase(pay.method) : "—"} via Razorpay</dd></div>
          <div><dt className="text-ink-muted">Payment ID</dt><dd className="mt-1 break-all font-mono text-[12.5px]">{pay?.razorpay_payment_id ?? "—"}</dd></div>
        </dl>
        <table className="w-full border-y border-line text-sm">
          <thead><tr className="text-left text-[12px] uppercase tracking-wide text-ink-muted"><th className="py-2.5">Item</th><th className="py-2.5 text-right">Amount</th></tr></thead>
          <tbody>
            <tr className="border-t border-line"><td className="py-3">{o.course?.title} — online course, lifetime access</td><td className="py-3 text-right font-mono">{formatINR(o.amount_paise, true)}</td></tr>
            {refunded ? <tr className="border-t border-line"><td className="py-3 text-ink-soft">Refunded</td><td className="py-3 text-right font-mono">−{formatINR(refunded, true)}</td></tr> : null}
          </tbody>
          <tfoot><tr className="border-t border-line font-semibold"><td className="py-3">Total paid ({o.currency})</td><td className="py-3 text-right font-mono">{formatINR(o.amount_paise - refunded, true)}</td></tr></tfoot>
        </table>
        <p className="mt-6 text-[12.5px] leading-6 text-ink-muted">
          This is a payment receipt, not a tax invoice. For a GST invoice, contact {publicEnv.supportEmail} with the receipt number and your GSTIN. Status: {titleCase(o.status)}.
        </p>
      </article>
    </div>
  );
}
