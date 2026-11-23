import Link from "next/link";
import { Award, GraduationCap, Plus, Users, Wallet } from "lucide-react";
import { requireInstructor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { statusTone } from "@/components/editor/course-editor";
import { formatINR, titleCase } from "@/lib/utils";

export default async function InstructorHome() {
  const user = await requireInstructor();
  const supabase = await createClient();
  const [{ data: stats }, { data: payouts }] = await Promise.all([
    supabase.rpc("instructor_course_stats"),
    supabase.from("instructor_payouts").select("amount_paise, status").eq("instructor_id", user.instructor.id),
  ]);
  const rows = (stats ?? []) as { course_id: string; title: string; status: string; enrolments: number; completions: number; earnings_paise: number }[];
  const earned = rows.reduce((s, r) => s + Number(r.earnings_paise), 0);
  const paid = (payouts ?? []).filter((p) => p.status === "paid").reduce((s, p) => s + p.amount_paise, 0);
  return (
    <>
      <PageHeader title={`Hello, ${user.instructor.display_name.split(" ")[0]}`} description="Your courses and earnings at a glance." actions={<ButtonLink href="/instructor/courses/new"><Plus className="size-4" />New course</ButtonLink>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Courses" value={rows.length} icon={<GraduationCap className="size-4" />} />
        <StatCard label="Active enrolments" value={rows.reduce((s, r) => s + r.enrolments, 0)} icon={<Users className="size-4" />} />
        <StatCard label="Certificates issued" value={rows.reduce((s, r) => s + r.completions, 0)} icon={<Award className="size-4" />} />
        <StatCard label="Net earnings" value={formatINR(earned)} hint={`Paid out ${formatINR(paid)} · Balance ${formatINR(earned - paid)}`} icon={<Wallet className="size-4" />} />
      </div>
      <Card className="mt-6">
        <CardHeader title="Course performance" />
        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.course_id}><Link href={`/instructor/courses/${r.course_id}`} className="grid gap-2 px-5 py-4 hover:bg-white/[0.03] sm:grid-cols-[2fr_1fr_1fr_1fr_1fr] sm:items-center">
                <span className="font-medium">{r.title}</span><span><Badge tone={statusTone[r.status]}>{titleCase(r.status)}</Badge></span>
                <span className="text-sm text-ink-soft">{r.enrolments} enrolments</span><span className="text-sm text-ink-soft">{r.completions} certificates</span><span className="text-sm font-semibold">{formatINR(Number(r.earnings_paise))}</span>
              </Link></li>
            ))}
          </ul>
        ) : <div className="p-5"><EmptyState title="No courses yet" description="Create your first course and submit it for review." action={<ButtonLink href="/instructor/courses/new">Create course</ButtonLink>} /></div>}
      </Card>
    </>
  );
}
