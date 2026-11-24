import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, ClipboardList, PlayCircle, Target, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getMyCourses } from "@/lib/data/student";
import { getMyAssignments, getMyQuizAttempts } from "@/lib/data/assessment";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, CardHeader, EmptyState, Progress, StatCard } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { evalLabel } from "@/components/assessment/assignment-panel";
import { formatDate } from "@/lib/utils";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ password?: string; purchased?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [courses, assignments, attempts, { data: notes }] = await Promise.all([
    getMyCourses(user.id),
    getMyAssignments(user.id),
    getMyQuizAttempts(user.id),
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const resume = courses.find((c) => c.last_lesson_id && c.percent < 100) ?? courses.find((c) => c.percent < 100);
  const firstName = (user.profile.full_name || "there").split(" ")[0];
  const evaluated = assignments.filter((a) => a.submission && ["evaluated", "reviewed"].includes(a.submission.eval_status) && a.submission.score != null);
  const avg = evaluated.length ? Math.round(evaluated.reduce((n, a) => n + (Number(a.submission!.score) / (a.submission!.max_score || a.assignment.max_score)) * 100, 0) / evaluated.length) : null;
  const pending = assignments.filter((a) => a.submission && ["pending", "evaluating", "needs_review", "failed"].includes(a.submission.eval_status));
  const todo = assignments.filter((a) => !a.submission || a.submission.status === "needs_revision").slice(0, 5);
  const passedQuizzes = new Set(attempts.filter((q) => q.passed).map((q) => q.quiz.id)).size;

  return (
    <div className="space-y-8">
      {sp.password === "updated" ? <Alert tone="success">Your password has been updated.</Alert> : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="kicker">Overview</p>
          <h1 className="mt-1 font-display text-[28px] font-semibold tracking-tight">Welcome back, {firstName}</h1>
        </div>
        <ButtonLink href="/courses" variant="secondary">Browse courses</ButtonLink>
      </div>

      {resume ? (
        <Card className="overflow-hidden">
          <div className="grid sm:grid-cols-[240px_1fr]">
            <div className="relative aspect-[16/9] bg-raised sm:aspect-auto">
              {resume.course.thumbnail_url ? <Image src={resume.course.thumbnail_url} alt="" fill className="object-cover" sizes="240px" unoptimized={resume.course.thumbnail_url.endsWith(".svg")} /> : null}
            </div>
            <div className="p-6">
              <p className="eyebrow">Continue learning</p>
              <p className="mt-2 font-display text-xl font-semibold">{resume.course.title.split(" — ")[0]}</p>
              {resume.lastLessonTitle ? <p className="mt-1 text-sm text-ink-muted">Where you left off: {resume.lastLessonTitle}</p> : null}
              <div className="mt-4 flex items-center gap-3"><Progress value={resume.percent} className="max-w-xs" /><span className="text-sm font-semibold">{resume.percent}%</span></div>
              <ButtonLink className="mt-5" href={resume.last_lesson_id ? `/learn/${resume.course.slug}/${resume.last_lesson_id}` : `/dashboard/learning/${resume.course.slug}`}><PlayCircle className="size-4" />Resume</ButtonLink>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Courses" value={courses.length} hint={`${courses.filter((c) => c.completed_at).length} completed`} icon={<BookOpen className="size-4" />} />
        <StatCard label="Assignments submitted" value={assignments.filter((a) => a.submission).length} hint={`of ${assignments.length} in your courses`} icon={<ClipboardList className="size-4" />} />
        <StatCard label="Average assignment score" value={avg == null ? "—" : `${avg}%`} hint={`${evaluated.length} evaluated`} icon={<Target className="size-4" />} />
        <StatCard label="Quizzes passed" value={passedQuizzes} hint={`${attempts.length} attempts`} icon={<Trophy className="size-4" />} />
      </div>

      {!courses.length ? (
        <EmptyState icon={<BookOpen className="size-5" />} title="No courses yet" description="Courses you buy appear here with their lessons, assignments and results." action={<ButtonLink href="/courses">Explore courses</ButtonLink>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Progress" action={<Link href="/dashboard/learning" className="text-sm font-semibold text-violet-300 hover:underline">My courses</Link>} />
              <ul className="divide-y divide-line">
                {courses.slice(0, 6).map((c) => (
                  <li key={c.enrolment_id}>
                    <Link href={`/dashboard/learning/${c.course.slug}`} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.course.title.split(" — ")[0]}</p>
                        <div className="mt-2 flex items-center gap-3"><Progress value={c.percent} /><span className="w-10 text-right text-[13px] font-semibold text-ink-soft">{c.percent}%</span></div>
                      </div>
                      <ArrowRight className="size-4 text-ink-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Up next" description="Assignments not yet submitted or needing revision" action={<Link href="/dashboard/assignments" className="text-sm font-semibold text-violet-300 hover:underline">All assignments</Link>} />
              {todo.length ? (
                <ul className="divide-y divide-line">
                  {todo.map((a) => {
                    const st = evalLabel(a.submission);
                    return (
                      <li key={a.assignment.id}>
                        <Link href={a.assignment.lesson_id ? `/learn/${a.course.slug}/${a.assignment.lesson_id}` : `/dashboard/learning/${a.course.slug}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-white/[0.02]">
                          <span className="min-w-0"><span className="block truncate text-sm font-medium">{a.assignment.title}</span><span className="block truncate text-[12.5px] text-ink-muted">{a.course.title.split(" — ")[0]}</span></span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="flex items-center gap-2 px-5 py-4 text-sm text-ink-muted"><CheckCircle2 className="size-4 text-cyan-400" />Everything is submitted.</p>}
            </Card>
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Awaiting results" />
              {pending.length ? (
                <ul className="divide-y divide-line">
                  {pending.map((a) => {
                    const st = evalLabel(a.submission);
                    return (
                      <li key={a.assignment.id} className="px-5 py-3">
                        <p className="truncate text-sm font-medium">{a.assignment.title}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-ink-muted"><Badge tone={st.tone}>{st.label}</Badge>{a.submission?.evaluate_after && a.submission.eval_status === "pending" ? `after ${formatDate(a.submission.evaluate_after, { hour: "numeric", minute: "2-digit" })}` : null}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : <p className="px-5 py-4 text-sm text-ink-muted">Nothing waiting for evaluation.</p>}
            </Card>
            <Card>
              <CardHeader title="Notifications" action={<Link href="/dashboard/notifications" className="text-sm font-semibold text-violet-300 hover:underline">All</Link>} />
              {notes?.length ? (
                <ul className="divide-y divide-line">
                  {notes.map((n) => (
                    <li key={n.id}>
                      <Link href={n.link ?? "/dashboard/notifications"} className="block px-5 py-3 hover:bg-white/[0.02]">
                        <p className="flex items-center gap-2 text-sm font-medium">{!n.read_at ? <span className="size-1.5 rounded-full bg-violet-400" /> : null}{n.title}</p>
                        <p className="mt-0.5 text-[12px] text-ink-muted">{formatDate(n.created_at)}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-5 py-4 text-sm text-ink-muted">You&apos;re all caught up.</p>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
