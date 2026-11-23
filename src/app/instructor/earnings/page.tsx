import { requireInstructor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Table } from "@/components/ui/primitives";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Earnings & payouts" };

export default async function EarningsPage() {
  const user = await requireInstructor();
  const supabase = await createClient();
  const [{ data: earnings }, { data: payouts }, { data: shares }] = await Promise.all([
    supabase.from("instructor_earnings").select("id, gross_paise, share_pct, amount_paise, created_at, refund_id, course:courses(title)").eq("instructor_id", user.instructor.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("instructor_payouts").select("*").eq("instructor_id", user.instructor.id).order("created_at", { ascending: false }),
    supabase.from("instructor_revenue_shares").select("share_pct, effective_from, effective_to, course:courses(title)").eq("instructor_id", user.instructor.id).order("effective_from", { ascending: false }),
  ]);
  type E = { id: string; gross_paise: number; share_pct: number; amount_paise: number; created_at: string; refund_id: string | null; course: { title: string } | null };
  const rows = (earnings ?? []) as unknown as E[];
  const net = rows.reduce((s, r) => s + r.amount_paise, 0);
  const paid = (payouts ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_paise, 0);
  return (
    <>
      <PageHeader title="Earnings & payouts" description="Earnings are recorded only for verified payments; refunds create matching reversals." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Net earnings" value={formatINR(net, true)} />
        <StatCard label="Paid out" value={formatINR(paid, true)} />
        <StatCard label="Balance due" value={formatINR(net - paid, true)} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card><CardHeader title="Earnings ledger" />
          {rows.length ? <div className="p-3"><Table className="border-0"><thead><tr><th>Date</th><th>Course</th><th>Sale</th><th>Share</th><th>Amount</th></tr></thead><tbody>
            {rows.map((r) => <tr key={r.id}><td>{formatDate(r.created_at)}</td><td>{r.course?.title}{r.refund_id ? <Badge tone="violet" className="ml-2">Refund</Badge> : null}</td><td>{formatINR(r.gross_paise, true)}</td><td>{Number(r.share_pct)}%</td><td className={r.amount_paise < 0 ? "text-red-400" : "font-semibold"}>{formatINR(r.amount_paise, true)}</td></tr>)}
          </tbody></Table></div> : <div className="p-5"><EmptyState title="No earnings yet" description="Earnings appear after verified sales of your published courses." /></div>}
        </Card>
        <div className="space-y-6">
          <Card><CardHeader title="Payouts" />
            {payouts?.length ? <ul className="divide-y divide-line">{payouts.map((p) => <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm"><span>{formatDate(p.period_start)} – {formatDate(p.period_end)}<span className="block text-[12px] text-ink-muted">{p.reference ?? "—"}</span></span><span className="text-right font-semibold">{formatINR(p.amount_paise, true)}<span className="block"><Badge tone={p.status === "paid" ? "success" : "warning"}>{titleCase(p.status)}</Badge></span></span></li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-muted">No payouts yet.</p>}
          </Card>
          <Card><CardHeader title="Revenue share" />
            <div className="p-5 text-sm">
              <p>Default share: <strong>{Number(user.instructor.default_revenue_share_pct)}%</strong></p>
              {(shares ?? []).length ? <ul className="mt-3 space-y-1.5">{(shares as unknown as { share_pct: number; effective_from: string; course: { title: string } | null }[]).map((s, i) => <li key={i} className="text-ink-soft">{s.course?.title ?? "All courses"}: {Number(s.share_pct)}% from {formatDate(s.effective_from)}</li>)}</ul> : null}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
