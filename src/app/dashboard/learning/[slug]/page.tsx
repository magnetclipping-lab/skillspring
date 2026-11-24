import Link from "next/link";
import { ArrowLeft, BadgeCheck, BarChart3, CheckCircle2, Circle, ClipboardList, FileText, Globe, PlayCircle, Video } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getLearningContext } from "@/lib/data/learning";
import { Alert, Card, CardHeader, Progress } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDuration } from "@/lib/utils";
import { ClaimCompletion } from "./claim-completion";
import type { LessonType } from "@/lib/types";

const icon: Record<LessonType, typeof Video> = { video: Video, text: FileText, pdf: FileText, external: Globe, assignment: ClipboardList, quiz: BarChart3 };

export default async function CourseHomePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ welcome?: string }> }) {
  const { slug } = await params;
  const { welcome } = await searchParams;
  const user = await requireUser(`/dashboard/learning/${slug}`);
  const ctx = await getLearningContext(slug, user);
  const next = ctx.flat.find((l) => l.id === ctx.enrolment?.last_lesson_id && !l.completed) ?? ctx.flat.find((l) => !l.completed) ?? ctx.flat[0];
  const s = ctx.completion;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/learning" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 hover:underline"><ArrowLeft className="size-4" />My courses</Link>
      {welcome ? <Alert tone="success" title="Payment verified — you're enrolled!">A confirmation has been sent to your email. Enjoy the course.</Alert> : null}
      {ctx.isStaff && ctx.enrolment?.status !== "active" ? <Alert tone="info">You&apos;re viewing this course as staff. Progress isn&apos;t tracked.</Alert> : null}

      <Card className="p-6">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">{ctx.course.title}</h1>
            <p className="mt-1 text-sm text-ink-muted">{ctx.modules.length} modules · {ctx.flat.length} items · {formatDuration(ctx.course.duration_minutes)}</p>
            <div className="mt-4 flex max-w-md items-center gap-3"><Progress value={ctx.percent} /><span className="text-sm font-semibold">{ctx.percent}%</span></div>
          </div>
          {next ? <ButtonLink href={`/learn/${slug}/${next.id}`} size="lg"><PlayCircle className="size-4" />{ctx.percent === 0 ? "Start course" : ctx.percent === 100 ? "Review course" : "Resume learning"}</ButtonLink> : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          {ctx.modules.map((m, mi) => (
            <Card key={m.id}>
              <CardHeader title={<><span className="mr-2 text-ink-muted">{String(mi + 1).padStart(2, "0")}</span>{m.title}</>} description={`${m.lessons.filter((l) => l.completed).length}/${m.lessons.length} complete`} />
              <ul className="divide-y divide-line">
                {m.lessons.map((l) => {
                  const Icon = icon[l.type];
                  return (
                    <li key={l.id}>
                      <Link href={`/learn/${slug}/${l.id}`} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-white/[0.03]">
                        {l.completed ? <CheckCircle2 className="size-4 shrink-0 text-cyan-400" /> : <Circle className="size-4 shrink-0 text-ink-muted/60" />}
                        <Icon className="size-4 shrink-0 text-ink-muted" />
                        <span className="flex-1">{l.title}{!l.is_mandatory ? <span className="ml-2 text-[11px] text-ink-muted">(optional)</span> : null}</span>
                        {l.duration_minutes ? <span className="text-[12px] text-ink-muted">{l.duration_minutes} min</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <p className="flex items-center gap-2 font-semibold"><BadgeCheck className="size-5 text-violet-300" />Completion</p>
            {ctx.certificate ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="text-ink-soft">{ctx.certificate.status === "valid" ? "Course completion recorded." : "This completion record was withdrawn."}</p>
                <p className="font-mono text-[12.5px] text-ink-muted">Record ID {ctx.certificate.certificate_code}{ctx.certificate.issued_at ? ` · ${formatDate(ctx.certificate.issued_at)}` : ""}</p>
                <p className="text-[12px] text-ink-muted">An internal Proofwork record, not an accredited qualification.</p>
              </div>
            ) : s ? (
              <div className="mt-3 space-y-3 text-sm">
                <Req ok={s.lessons.ok} label={`Required lessons: ${s.lessons.done}/${s.lessons.required}`} />
                {s.assignments.required ? <Req ok={s.assignments.ok} label={`Required assignments: ${s.assignments.done}/${s.assignments.required}`} /> : null}
                {s.quizzes.required ? <Req ok={s.quizzes.ok} label={`Quizzes passed: ${s.quizzes.passed}/${s.quizzes.required}${s.quizzes.min_pct ? ` (min ${s.quizzes.min_pct}%)` : ""}`} /> : null}
                <ClaimCompletion courseId={ctx.course.id} eligible={s.eligible} />
              </div>
            ) : <p className="mt-2 text-sm text-ink-muted">Available to enrolled learners.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return <p className="flex items-center gap-2">{ok ? <CheckCircle2 className="size-4 text-cyan-400" /> : <Circle className="size-4 text-ink-muted/60" />}<span className={ok ? "text-ink" : "text-ink-soft"}>{label}</span></p>;
}
