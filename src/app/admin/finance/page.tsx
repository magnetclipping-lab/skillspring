import { Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { adminCreatePayoutAction, adminMarkPayoutPaidAction, adminRefundAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Badge, type BadgeTone, Card, CardHeader, Field, Input, PageHeader, Select, StatCard, Table } from "@/components/ui/primitives";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Finance" };
const tone: Record<string, BadgeTone> = { captured: "success", failed: "danger", refunded: "violet", partially_refunded: "violet", authorized: "warning", processed: "success", pending: "warning", requested: "warning", rejected: "danger", paid: "success" };

export default async function AdminFinance() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: payments }, { data: refunds }, { data: courseRevenue }, { data: instructors }, { data: earnings }, { data: payouts }] = await Promise.all([
    supabase.from("payments").select("id, razorpay_payment_id, amount_paise, status, method, verified_via, created_at, user:profiles(full_name, email), order:orders(receipt, course:courses(title))").order("created_at", { ascending: false }).limit(100),
    supabase.from("refunds").select("id, razorpay_refund_id, amount_paise, status, reason, created_at, processed_at, user:profiles(email)").order("created_at", { ascending: false }).limit(50),
    supabase.rpc("admin_course_revenue"),
    supabase.from("instructor_profiles").select("id, display_name").eq("status", "approved"),
    supabase.from("instructor_earnings").select("instructor_id, amount_paise"),
    supabase.from("instructor_payouts").select("*, instructor:instructor_profiles(display_name)").order("created_at", { ascending: false }),
  ]);
  type P = { id: string; razorpay_payment_id: string; amount_paise: number; status: string; method: string | null; verified_via: string | null; created_at: string; user: { full_name: string; email: string } | null; order: { receipt: string; course: { title: string } | null } | null };
  const pays = (payments ?? []) as unknown as P[];
  const gross = pays.filter((p) => p.status !== "failed").reduce((s, p) => s + p.amount_paise, 0);
  const refunded = (refunds ?? []).filter((r) => r.status === "processed").reduce((s, r) => s + r.amount_paise, 0);
  const balance = (id: string) => (earnings ?? []).filter((e) => e.instructor_id === id).reduce((s, e) => s + e.amount_paise, 0) - (payouts ?? []).filter((p) => p.instructor_id === id && p.status === "paid").reduce((s, p) => s + p.amount_paise, 0);
  const exp = (t: string) => <a href={`/api/admin/export/${t}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-300 hover:underline"><Download className="size-3.5" />CSV</a>;

  return (
    <>
      <PageHeader title="Finance & reporting" description="All figures come from verified payment records." actions={<div className="flex gap-4">{exp("transactions")}{exp("refunds")}{exp("course-revenue")}{exp("payouts")}</div>} />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Gross (last 100 payments)" value={formatINR(gross)} />
        <StatCard label="Refunded" value={formatINR(refunded)} />
        <StatCard label="Net" value={formatINR(gross - refunded)} />
      </div>

      <Card className="mt-6"><CardHeader title="Transactions" action={exp("transactions")} />
        <div className="p-3"><Table className="border-0"><thead><tr><th>Date</th><th>Student</th><th>Course</th><th>Amount</th><th>Method</th><th>Status</th><th>Payment ID</th></tr></thead><tbody>
          {pays.map((p) => <tr key={p.id}><td>{formatDate(p.created_at)}</td><td>{p.user?.email}</td><td>{p.order?.course?.title}</td><td>{formatINR(p.amount_paise, true)}</td><td>{p.method ?? "—"}</td><td><Badge tone={tone[p.status]}>{titleCase(p.status)}</Badge><span className="ml-1 text-[11px] text-ink-muted">{p.verified_via === "webhook" ? "webhook" : "signature"}</span></td><td className="font-mono text-[12px]">{p.razorpay_payment_id}</td></tr>)}
        </tbody></Table></div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Issue a refund" description="Creates the refund in Razorpay; status is confirmed by webhook." />
          <ActionForm action={adminRefundAction} className="space-y-3 p-5">
            <Field label="Payment" name="payment_id"><Select id="payment_id" name="payment_id" defaultValue="">{[<option key="" value="" disabled>Select a captured payment…</option>, ...pays.filter((p) => ["captured", "partially_refunded"].includes(p.status)).map((p) => <option key={p.id} value={p.id}>{p.order?.course?.title} · {p.user?.email} · {formatINR(p.amount_paise, true)}</option>)]}</Select></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Amount (₹)" name="amount"><Input id="amount" name="amount" type="number" min={1} step="0.01" required /></Field><Field label="Reason" name="reason"><Input id="reason" name="reason" required /></Field></div>
            <SubmitButton variant="danger" pendingText="Refunding…">Refund via Razorpay</SubmitButton>
          </ActionForm>
          <div className="border-t border-line p-3"><Table className="border-0"><thead><tr><th>Date</th><th>User</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {((refunds ?? []) as unknown as { id: string; amount_paise: number; status: string; created_at: string; user: { email: string } | null }[]).map((r) => <tr key={r.id}><td>{formatDate(r.created_at)}</td><td>{r.user?.email}</td><td>{formatINR(r.amount_paise, true)}</td><td><Badge tone={tone[r.status]}>{titleCase(r.status)}</Badge></td></tr>)}
          </tbody></Table></div>
        </Card>

        <Card><CardHeader title="Course-wise revenue" action={exp("course-revenue")} />
          <div className="p-3"><Table className="border-0"><thead><tr><th>Course</th><th>Sales</th><th>Gross</th><th>Refunds</th></tr></thead><tbody>
            {((courseRevenue ?? []) as { course_id: string; title: string; sales: number; gross_paise: number; refunds_paise: number }[]).filter((r) => r.sales > 0).map((r) => <tr key={r.course_id}><td>{r.title}</td><td>{r.sales}</td><td>{formatINR(Number(r.gross_paise))}</td><td>{formatINR(Number(r.refunds_paise))}</td></tr>)}
          </tbody></Table>{!(courseRevenue ?? []).some((r: { sales: number }) => r.sales > 0) ? <p className="px-2 py-3 text-sm text-ink-muted">No sales yet.</p> : null}</div>
        </Card>
      </div>

      <Card className="mt-6"><CardHeader title="Instructor payouts" description="Record payouts made outside the platform (bank transfer / UPI) and mark them paid." action={exp("payouts")} />
        <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.4fr]">
          <ActionForm action={adminCreatePayoutAction} className="space-y-3">
            <Field label="Instructor" name="instructor_id"><Select id="instructor_id" name="instructor_id">{(instructors ?? []).map((i) => <option key={i.id} value={i.id}>{i.display_name} — balance {formatINR(balance(i.id), true)}</option>)}</Select></Field>
            <div className="grid grid-cols-3 gap-3"><Field label="Amount (₹)" name="amount"><Input id="amount" name="amount" type="number" min={1} step="0.01" required /></Field><Field label="From" name="period_start"><Input id="period_start" name="period_start" type="date" required /></Field><Field label="To" name="period_end"><Input id="period_end" name="period_end" type="date" required /></Field></div>
            <Field label="Reference" name="reference"><Input id="reference" name="reference" placeholder="UTR / transaction reference" /></Field>
            <SubmitButton variant="secondary">Record payout</SubmitButton>
          </ActionForm>
          <Table><thead><tr><th>Instructor</th><th>Period</th><th>Amount</th><th>Status</th><th /></tr></thead><tbody>
            {((payouts ?? []) as unknown as { id: string; amount_paise: number; status: string; period_start: string; period_end: string; instructor: { display_name: string } | null }[]).map((p) => <tr key={p.id}><td>{p.instructor?.display_name}</td><td>{formatDate(p.period_start)} – {formatDate(p.period_end)}</td><td>{formatINR(p.amount_paise, true)}</td><td><Badge tone={tone[p.status] ?? "neutral"}>{titleCase(p.status)}</Badge></td><td>{p.status !== "paid" ? <form action={adminMarkPayoutPaidAction} className="flex gap-1"><input type="hidden" name="id" value={p.id} /><Input name="reference" placeholder="UTR" className="h-8 w-24 text-xs" /><SubmitButton size="sm">Mark paid</SubmitButton></form> : null}</td></tr>)}
          </tbody></Table>
        </div>
      </Card>
    </>
  );
}
