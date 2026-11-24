import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getMyAssignments, getMyQuizAttempts } from "@/lib/data/assessment";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Table } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Results" };

export default async function ResultsPage() {
  const user = await requireUser("/dashboard/results");
  const [assignments, attempts] = await Promise.all([getMyAssignments(user.id), getMyQuizAttempts(user.id)]);
  const scored = assignments
    .filter((a) => a.submission && ["evaluated", "reviewed"].includes(a.submission.eval_status) && a.submission.score != null)
    .sort((x, y) => +new Date(y.submission!.evaluated_at ?? 0) - +new Date(x.submission!.evaluated_at ?? 0));
  const pct = (a: (typeof scored)[number]) => Math.round((Number(a.submission!.score) / (a.submission!.max_score || a.assignment.max_score)) * 100);
  const avg = scored.length ? Math.round(scored.reduce((n, a) => n + pct(a), 0) / scored.length) : null;
  const best = new Map<string, (typeof attempts)[number]>();
  for (const q of attempts) if (!best.has(q.quiz.id) || best.get(q.quiz.id)!.score_pct < q.score_pct) best.set(q.quiz.id, q);
  const quizAvg = best.size ? Math.round([...best.values()].reduce((n, q) => n + q.score_pct, 0) / best.size) : null;

  // Performance by criterion across all evaluated assignments.
  const crit = new Map<string, { got: number; max: number }>();
  for (const a of scored) for (const c of a.submission!.ai_criteria ?? []) {
    const k = crit.get(c.criterion) ?? { got: 0, max: 0 };
    crit.set(c.criterion, { got: k.got + Number(c.score), max: k.max + Number(c.max) });
  }
  const criteria = [...crit.entries()].map(([k, v]) => ({ k, pct: v.max ? Math.round((v.got / v.max) * 100) : 0 })).sort((a, b) => a.pct - b.pct);

  return (
    <>
      <PageHeader eyebrow="Learning" title="Results" description="Marks and feedback for evaluated assignments and quizzes." />
      {!scored.length && !attempts.length ? (
        <EmptyState icon={<BarChart3 className="size-5" />} title="No results yet" description="Results appear here after your first quiz attempt or evaluated assignment." action={<ButtonLink href="/dashboard/assignments">Go to assignments</ButtonLink>} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Assignment average" value={avg == null ? "—" : `${avg}%`} hint={`${scored.length} evaluated`} />
            <StatCard label="Quiz average (best attempt)" value={quizAvg == null ? "—" : `${quizAvg}%`} hint={`${best.size} quizzes`} />
            <StatCard label="Passed" value={scored.filter((a) => a.submission!.status === "approved").length + [...best.values()].filter((q) => q.passed).length} hint="assignments + quizzes" />
          </div>

          {criteria.length ? (
            <Card>
              <CardHeader title="Performance by rubric criterion" description="Where you score highest and lowest across all evaluated work" />
              <ul className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
                {criteria.map((c) => (
                  <li key={c.k}>
                    <div className="flex justify-between text-sm"><span className="text-ink-soft">{c.k}</span><span className="font-mono text-ink-muted">{c.pct}%</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]"><div className={c.pct < 50 ? "h-full rounded-full bg-amber-400" : "h-full rounded-full bg-cyan-400"} style={{ width: `${c.pct}%` }} /></div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {scored.length ? (
            <Table>
              <thead><tr><th>Assignment</th><th>Course</th><th>Score</th><th>Status</th><th>Evaluated</th></tr></thead>
              <tbody>
                {scored.map((a) => (
                  <tr key={a.assignment.id}>
                    <td><Link className="font-medium hover:text-violet-200" href={a.assignment.lesson_id ? `/learn/${a.course.slug}/${a.assignment.lesson_id}` : `/dashboard/learning/${a.course.slug}`}>{a.assignment.title}</Link></td>
                    <td className="text-ink-muted">{a.course.title.split(" — ")[0]}</td>
                    <td className="font-mono">{Math.round(Number(a.submission!.score))}/{a.submission!.max_score ?? a.assignment.max_score}</td>
                    <td><Badge tone={a.submission!.status === "approved" ? "success" : "danger"}>{a.submission!.status === "approved" ? "Passed" : "Needs revision"}</Badge>{a.submission!.score_source === "human" ? <span className="ml-2 text-[12px] text-ink-muted">reviewed</span> : null}</td>
                    <td className="text-ink-muted">{formatDate(a.submission!.evaluated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}

          {attempts.length ? (
            <Table>
              <thead><tr><th>Quiz</th><th>Course</th><th>Score</th><th>Result</th><th>Date</th></tr></thead>
              <tbody>
                {attempts.slice(0, 50).map((q) => (
                  <tr key={q.id}>
                    <td><Link className="font-medium hover:text-violet-200" href={q.quiz.lesson_id ? `/learn/${q.quiz.course.slug}/${q.quiz.lesson_id}` : `/dashboard/learning/${q.quiz.course.slug}`}>{q.quiz.title}</Link></td>
                    <td className="text-ink-muted">{q.quiz.course.title.split(" — ")[0]}</td>
                    <td className="font-mono">{q.score_pct}%</td>
                    <td><Badge tone={q.passed ? "success" : "warning"}>{q.passed ? "Passed" : "Not passed"}</Badge></td>
                    <td className="text-ink-muted">{formatDate(q.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : null}
        </div>
      )}
    </>
  );
}
