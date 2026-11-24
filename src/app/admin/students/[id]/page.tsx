import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { adminGrantEnrolmentAction, adminRevokeEnrolmentAction, adminSetRoleAction, adminSuspendUserAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, Input, Select, Table } from "@/components/ui/primitives";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export default async function AdminStudentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const { error } = await searchParams;
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: p }, { data: roles }, { data: enrolments }, { data: orders }, { data: certs }, { data: subs }, { data: progress }, { data: courses }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", id),
    supabase.from("enrolments").select("id, status, source, enrolled_at, completed_at, course:courses(id, title)").eq("user_id", id),
    supabase.from("orders").select("id, amount_paise, status, created_at, course:courses(title)").eq("user_id", id).order("created_at", { ascending: false }),
    supabase.from("certificates").select("certificate_code, course_title, status, issued_at").eq("user_id", id),
    supabase.from("assignment_submissions").select("id, eval_status, status, score, max_score, version, submitted_at, assignment:assignments(title)").eq("user_id", id).order("submitted_at", { ascending: false }).limit(50),
    supabase.from("lesson_progress").select("course_id, completed_at").eq("user_id", id),
    supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
  ]);
  if (!p) notFound();
  const r = (roles ?? []).map((x) => x.role as string);
  const { data: lessonCounts } = await supabase.from("lessons").select("course_id").in("course_id", (enrolments ?? []).map((e) => (e.course as unknown as { id: string }).id));
  const pct = (courseId: string) => {
    const total = (lessonCounts ?? []).filter((l) => l.course_id === courseId).length;
    const done = (progress ?? []).filter((x) => x.course_id === courseId && x.completed_at).length;
    return total ? Math.round((done / total) * 100) : 0;
  };
  type En = { id: string; status: string; source: string; enrolled_at: string; completed_at: string | null; course: { id: string; title: string } };
  return (
    <div className="space-y-6">
      <Link href="/admin/students" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 hover:underline"><ArrowLeft className="size-4" />Students</Link>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-bold">{p.full_name || p.email}</h1>{r.map((x) => <Badge key={x} tone={x === "admin" ? "danger" : x === "instructor" ? "violet" : "neutral"}>{x}</Badge>)}{p.is_suspended ? <Badge tone="danger">Suspended</Badge> : null}</div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card><CardHeader title="Courses & progress" />
            <div className="p-3"><Table className="border-0"><thead><tr><th>Course</th><th>Source</th><th>Status</th><th>Progress</th><th /></tr></thead><tbody>
              {((enrolments ?? []) as unknown as En[]).map((e) => <tr key={e.id}><td>{e.course.title}</td><td>{titleCase(e.source)}</td><td><Badge tone={e.status === "active" ? "success" : "neutral"}>{titleCase(e.status)}</Badge></td><td>{pct(e.course.id)}%</td><td>{e.status === "active" ? <form action={adminRevokeEnrolmentAction}><input type="hidden" name="enrolment_id" value={e.id} /><input type="hidden" name="user_id" value={id} /><button className="text-[12.5px] font-semibold text-red-400 hover:underline">Revoke</button></form> : null}</td></tr>)}
            </tbody></Table></div>
            <div className="border-t border-line p-4">
              <ActionForm action={adminGrantEnrolmentAction} className="flex flex-wrap items-center gap-2" compact>
                <input type="hidden" name="user_id" value={id} />
                <Select name="course_id" className="max-w-xs" defaultValue=""><option value="" disabled>Grant access to a course…</option>{(courses ?? []).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
                <SubmitButton variant="secondary">Grant access</SubmitButton>
              </ActionForm>
            </div>
          </Card>
          <Card><CardHeader title="Purchases" />
            {(orders ?? []).length ? <ul className="divide-y divide-line text-sm">{(orders as unknown as { id: string; amount_paise: number; status: string; created_at: string; course: { title: string } | null }[]).map((o) => <li key={o.id} className="flex justify-between px-5 py-3"><span>{o.course?.title} · {formatDate(o.created_at)}</span><span>{formatINR(o.amount_paise, true)} <Badge>{titleCase(o.status)}</Badge></span></li>)}</ul> : <p className="px-5 py-4 text-sm text-ink-muted">No purchases.</p>}
          </Card>
          <Card><CardHeader title="Assignment submissions" action={<Link href="/admin/submissions?f=" className="text-sm font-semibold text-violet-300 hover:underline">Review queue</Link>} />
            {(subs ?? []).length ? <ul className="divide-y divide-line text-sm">
              {((subs ?? []) as unknown as { id: string; eval_status: string; status: string; score: number | null; max_score: number | null; version: number; submitted_at: string; assignment: { title: string } | null }[]).map((s) => <li key={s.id} className="flex justify-between gap-3 px-5 py-3"><span>{s.assignment?.title} <span className="text-[12px] text-ink-muted">v{s.version} · {formatDate(s.submitted_at)}</span></span><span className="flex items-center gap-2">{s.score != null ? <span className="font-mono">{Math.round(Number(s.score))}/{s.max_score}</span> : null}<Badge>{titleCase(s.eval_status)}</Badge></span></li>)}
            </ul> : <p className="px-5 py-4 text-sm text-ink-muted">No submissions.</p>}
          </Card>
          <Card><CardHeader title="Completion records" />
            {(certs ?? []).length ? <ul className="divide-y divide-line text-sm">
              {(certs ?? []).map((c) => <li key={c.certificate_code} className="flex justify-between px-5 py-3"><span>{c.course_title} <span className="font-mono text-[12px] text-ink-muted">{c.certificate_code}</span></span><Badge tone={c.status === "valid" ? "success" : "danger"}>{c.status}</Badge></li>)}
            </ul> : <p className="px-5 py-4 text-sm text-ink-muted">None yet.</p>}
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5 text-sm">
            <dl className="space-y-2">{[["Email", p.email], ["Phone", p.phone], ["College", p.college], ["Degree", p.degree], ["Graduation", p.graduation_year], ["Skills", p.skills?.join(", ")], ["Joined", formatDate(p.created_at)]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-4"><dt className="text-ink-muted">{k}</dt><dd className="text-right">{v || "—"}</dd></div>)}</dl>
          </Card>
          <Card><CardHeader title="Roles" />
            <div className="flex flex-wrap gap-2 p-5">{(["instructor", "admin"] as const).map((role) => <form key={role} action={adminSetRoleAction}><input type="hidden" name="user_id" value={id} /><input type="hidden" name="role" value={role} /><input type="hidden" name="grant" value={r.includes(role) ? "false" : "true"} /><SubmitButton variant="secondary" size="sm">{r.includes(role) ? `Remove ${role}` : `Make ${role}`}</SubmitButton></form>)}</div>
            <p className="px-5 pb-4 text-[12px] text-ink-muted">Instructors also need an approved instructor profile to access the portal.</p>
          </Card>
          <Card><CardHeader title={p.is_suspended ? "Reinstate account" : "Suspend account"} />
            <ActionForm action={adminSuspendUserAction} className="space-y-2 p-5" compact>
              <input type="hidden" name="user_id" value={id} /><input type="hidden" name="suspend" value={p.is_suspended ? "false" : "true"} />
              {p.is_suspended ? <p className="text-sm text-ink-muted">Reason: {p.suspended_reason}</p> : <Input name="reason" placeholder="Reason (required, recorded in audit log)" />}
              <SubmitButton variant={p.is_suspended ? "secondary" : "danger"} size="sm">{p.is_suspended ? "Reinstate" : "Suspend"}</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}
