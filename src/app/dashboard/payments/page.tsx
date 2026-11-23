import { CreditCard } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, type BadgeTone, EmptyState, PageHeader, Table } from "@/components/ui/primitives";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Payment history" };

const tone: Record<string, BadgeTone> = { paid: "success", created: "neutral", attempted: "warning", failed: "danger", refunded: "violet", partially_refunded: "violet" };

export default async function PaymentsPage() {
  const user = await requireUser("/dashboard/payments");
  const supabase = await createClient();
  const [{ data: orders }, { data: refunds }] = await Promise.all([
    supabase.from("orders").select("id, receipt, amount_paise, status, created_at, paid_at, course:courses(title), payments(razorpay_payment_id, method, status)").eq("user_id", user.id).neq("status", "created").order("created_at", { ascending: false }),
    supabase.from("refunds").select("id, amount_paise, status, created_at, processed_at, order_id").eq("user_id", user.id),
  ]);
  type Row = { id: string; receipt: string; amount_paise: number; status: string; created_at: string; paid_at: string | null; course: { title: string } | null; payments: { razorpay_payment_id: string; method: string | null; status: string }[] };
  const rows = (orders ?? []) as unknown as Row[];
  return (
    <>
      <PageHeader title="Payment history" description="Every payment attempt and refund on your account. Card details are never stored by Proofwork." />
      {rows.length ? (
        <Table>
          <thead><tr><th>Date</th><th>Course</th><th>Amount</th><th>Method</th><th>Status</th><th>Reference</th></tr></thead>
          <tbody>
            {rows.map((o) => {
              const pay = o.payments.find((p) => p.status !== "failed") ?? o.payments[0];
              const rf = (refunds ?? []).filter((r) => r.order_id === o.id);
              return (
                <tr key={o.id}>
                  <td>{formatDate(o.paid_at ?? o.created_at)}</td>
                  <td className="font-medium">{o.course?.title}</td>
                  <td>{formatINR(o.amount_paise, true)}{rf.map((r) => <p key={r.id} className="text-[12px] text-violet-300">Refund {formatINR(r.amount_paise, true)} · {titleCase(r.status)}</p>)}</td>
                  <td>{pay?.method ? titleCase(pay.method) : "—"}</td>
                  <td><Badge tone={tone[o.status]}>{titleCase(o.status)}</Badge></td>
                  <td className="font-mono text-[12px] text-ink-muted">{pay?.razorpay_payment_id ?? o.receipt}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : <EmptyState icon={<CreditCard className="size-5" />} title="No payments yet" description="Your purchases will appear here." />}
    </>
  );
}
