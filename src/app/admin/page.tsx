import Link from "next/link";
import { AlertTriangle, CheckCircle2, ClipboardList, GraduationCap, IndianRupee, RotateCcw, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { integrationStatus } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, PageHeader, StatCard, Table } from "@/components/ui/primitives";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export default async function AdminOverview() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: o }, { data: tx }, { count: needsReview }, { count: pendingEval }, { count: failedJobs }] = await Promise.all([
    supabase.rpc("admin_overview"),
    supabase.from("payments").select("id, amount_paise, status, method, created_at, razorpay_payment_id, order:orders(course:courses(title)), user:profiles(full_name, email)").order("created_at", { ascending: false }).limit(8),
    supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).in("eval_status", ["needs_review", "failed"]),
    supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).in("eval_status", ["pending", "evaluating"]),
    supabase.from("evaluation_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
  ]);
  const s = (o ?? {}) as Record<string, number>;
  const integrations = integrationStatus();
  type Tx = { id: string; amount_paise: number; status: string; method: string | null; created_at: string; razorpay_payment_id: string; order: { course: { title: string } | null } | null; user: { full_name: string; email: string } | null };
  return (
    <>
      <PageHeader title="Overview" description="Live figures from the database." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Registered students" value={s.students ?? 0} icon={<Users className="size-4" />} />
        <StatCard label="Paid enrolments" value={s.paid_enrolments ?? 0} icon={<GraduationCap className="size-4" />} />
        <StatCard label="Courses" value={s.courses ?? 0} hint={`${s.published_courses ?? 0} published · ${s.pending_course_reviews ?? 0} awaiting review`} icon={<GraduationCap className="size-4" />} />
        <StatCard label="Gross revenue" value={formatINR(Number(s.revenue_paise ?? 0))} icon={<IndianRupee className="size-4" />} />
        <StatCard label="Refunds processed" value={formatINR(Number(s.refunds_paise ?? 0))} icon={<RotateCcw className="size-4" />} />
        <StatCard label="Net revenue" value={formatINR(Number(s.revenue_paise ?? 0) - Number(s.refunds_paise ?? 0))} icon={<IndianRupee className="size-4" />} />
        <StatCard label="Submissions needing review" value={<Link href="/admin/submissions" className="hover:text-violet-200">{needsReview ?? 0}</Link>} hint={`${pendingEval ?? 0} pending evaluation · ${failedJobs ?? 0} failed jobs`} icon={<ClipboardList className="size-4" />} />
        <StatCard label="Instructor applications" value={s.pending_instructors ?? 0} icon={<Users className="size-4" />} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader title="Recent transactions" action={<Link href="/admin/finance" className="text-sm font-semibold text-violet-300 hover:underline">Revenue →</Link>} />
          {(tx ?? []).length ? <div className="p-3"><Table className="border-0"><thead><tr><th>Date</th><th>Student</th><th>Course</th><th>Amount</th><th>Status</th></tr></thead><tbody>
            {(tx as unknown as Tx[]).map((t) => <tr key={t.id}><td>{formatDate(t.created_at)}</td><td>{t.user?.full_name || t.user?.email}</td><td>{t.order?.course?.title}</td><td>{formatINR(t.amount_paise, true)}</td><td><Badge tone={t.status === "captured" ? "success" : t.status === "failed" ? "danger" : "violet"}>{titleCase(t.status)}</Badge></td></tr>)}
          </tbody></Table></div> : <p className="px-5 py-4 text-sm text-ink-muted">No transactions yet.</p>}
        </Card>
        <Card>
          <CardHeader title="Integration status" description="Configured via environment variables" />
          <ul className="divide-y divide-line text-sm">
            {[
              ["Supabase service role", integrations.supabaseAdmin],
              [`Razorpay ${integrations.razorpayLiveMode ? "(LIVE)" : "(test mode)"}`, integrations.razorpay],
              ["Razorpay webhook secret", integrations.razorpayWebhook],
              ["Email (Resend)", integrations.email],
              ["AI evaluation (Anthropic)", integrations.anthropic],
              ["Mux signed playback", integrations.mux],
              ["Mux direct uploads", integrations.muxUploads],
              ["Cloudflare Stream", integrations.cloudflareStream],
            ].map(([k, v]) => (
              <li key={String(k)} className="flex items-center justify-between px-5 py-3">{k}{v ? <span className="flex items-center gap-1.5 font-medium text-emerald-300"><CheckCircle2 className="size-4" />Configured</span> : <span className="flex items-center gap-1.5 font-medium text-amber-300"><AlertTriangle className="size-4" />Not configured</span>}</li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
