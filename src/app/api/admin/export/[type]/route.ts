import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { toCsv } from "@/lib/csv";

/** CSV exports for administrators. Data is read with the admin's session (RLS admin policies). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const user = await getSessionUser();
  if (!user || !user.roles.includes("admin") || user.profile.is_suspended) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = await createClient();
  let rows: Record<string, unknown>[] = [];

  if (type === "transactions") {
    const { data } = await supabase.from("payments").select("created_at, razorpay_payment_id, amount_paise, status, method, verified_via, user:profiles(full_name, email), order:orders(receipt, razorpay_order_id, course:courses(title))").order("created_at", { ascending: false });
    rows = ((data ?? []) as unknown as { created_at: string; razorpay_payment_id: string; amount_paise: number; status: string; method: string | null; verified_via: string | null; user: { full_name: string; email: string } | null; order: { receipt: string; razorpay_order_id: string; course: { title: string } | null } | null }[]).map((p) => ({
      date: p.created_at, payment_id: p.razorpay_payment_id, order_id: p.order?.razorpay_order_id, receipt: p.order?.receipt, student: p.user?.full_name, email: p.user?.email, course: p.order?.course?.title, amount_inr: (p.amount_paise / 100).toFixed(2), status: p.status, method: p.method, verified_via: p.verified_via,
    }));
  } else if (type === "refunds") {
    const { data } = await supabase.from("refunds").select("created_at, processed_at, razorpay_refund_id, amount_paise, status, reason, user:profiles(email)");
    rows = ((data ?? []) as unknown as { created_at: string; processed_at: string | null; razorpay_refund_id: string | null; amount_paise: number; status: string; reason: string | null; user: { email: string } | null }[]).map((r) => ({ date: r.created_at, processed_at: r.processed_at, refund_id: r.razorpay_refund_id, email: r.user?.email, amount_inr: (r.amount_paise / 100).toFixed(2), status: r.status, reason: r.reason }));
  } else if (type === "course-revenue") {
    const { data } = await supabase.rpc("admin_course_revenue");
    rows = ((data ?? []) as { title: string; sales: number; gross_paise: number; refunds_paise: number }[]).map((r) => ({ course: r.title, sales: r.sales, gross_inr: (Number(r.gross_paise) / 100).toFixed(2), refunds_inr: (Number(r.refunds_paise) / 100).toFixed(2), net_inr: ((Number(r.gross_paise) - Number(r.refunds_paise)) / 100).toFixed(2) }));
  } else if (type === "payouts") {
    const { data } = await supabase.from("instructor_payouts").select("created_at, period_start, period_end, amount_paise, status, reference, paid_at, instructor:instructor_profiles(display_name)");
    rows = ((data ?? []) as unknown as { created_at: string; period_start: string; period_end: string; amount_paise: number; status: string; reference: string | null; paid_at: string | null; instructor: { display_name: string } | null }[]).map((p) => ({ instructor: p.instructor?.display_name, period_start: p.period_start, period_end: p.period_end, amount_inr: (p.amount_paise / 100).toFixed(2), status: p.status, reference: p.reference, paid_at: p.paid_at }));
  } else if (type === "submissions") {
    const { data } = await supabase.from("assignment_submissions").select("submitted_at, version, eval_status, status, score, max_score, score_source, evaluated_at, user:profiles(full_name, email), assignment:assignments(title, kind), course:courses(title)").order("submitted_at", { ascending: false });
    rows = ((data ?? []) as unknown as { submitted_at: string; version: number; eval_status: string; status: string; score: number | null; max_score: number | null; score_source: string | null; evaluated_at: string | null; user: { full_name: string; email: string } | null; assignment: { title: string; kind: string } | null; course: { title: string } | null }[]).map((r) => ({ submitted_at: r.submitted_at, course: r.course?.title, assignment: r.assignment?.title, type: r.assignment?.kind, learner: r.user?.full_name, email: r.user?.email, version: r.version, evaluation: r.eval_status, status: r.status, score: r.score, max_score: r.max_score, scored_by: r.score_source, evaluated_at: r.evaluated_at }));
  } else if (type === "ambassadors") {
    const { data } = await supabase.from("ambassador_applications").select("created_at, full_name, email, phone, college, city, course_and_year, social_url, status, referral_code, admin_notes").order("created_at", { ascending: false });
    rows = (data ?? []) as Record<string, unknown>[];
  } else {
    return NextResponse.json({ error: "Unknown export" }, { status: 404 });
  }

  await audit(user.id, "export.csv", "report", type, { rows: rows.length });
  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="proofwork-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
