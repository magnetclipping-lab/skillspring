import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Download, ExternalLink, FileText, X } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getLearningContext } from "@/lib/data/learning";
import { createClient } from "@/lib/supabase/server";
import { Markdown } from "@/components/lesson/markdown";
import { LessonVideo } from "@/components/lesson/video";
import { Alert, Badge, Progress } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/site/logo";
import { cn, titleCase } from "@/lib/utils";
import { AssignmentPanel, CompleteButton, QuizRunner, TouchLesson, type QuizData } from "./client";

export const metadata: Metadata = { title: "Lesson", robots: { index: false } };

export default async function LessonPlayerPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const { slug, lessonId } = await params;
  const user = await requireUser(`/learn/${slug}/${lessonId}`);
  const ctx = await getLearningContext(slug, user);
  const idx = ctx.flat.findIndex((l) => l.id === lessonId);
  if (idx < 0) notFound();
  const lesson = ctx.flat[idx];
  const prev = ctx.flat[idx - 1];
  const next = ctx.flat[idx + 1];
  const enrolled = ctx.enrolment?.status === "active";

  const supabase = await createClient();
  const [{ data: resources }, { data: quizRow }, { data: assignment }] = await Promise.all([
    supabase.from("lesson_resources").select("id, title, kind, external_url, file_size_bytes").eq("lesson_id", lesson.id).order("created_at"),
    supabase.from("quizzes").select("id").eq("lesson_id", lesson.id).maybeSingle(),
    supabase.from("assignments").select("id, title, instructions, allow_file, is_mandatory").eq("lesson_id", lesson.id).maybeSingle(),
  ]);
  let quiz: QuizData | null = null;
  if (quizRow) {
    const { data } = await supabase.rpc("get_quiz", { p_quiz_id: quizRow.id });
    quiz = data as QuizData;
  }
  let submission: { id: string; status: string; text_response: string | null; file_path: string | null; feedback: string | null } | null = null;
  if (assignment) {
    const { data } = await supabase.from("assignment_submissions").select("id, status, text_response, file_path, feedback").eq("assignment_id", assignment.id).eq("user_id", user.id).maybeSingle();
    submission = data;
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {enrolled ? <TouchLesson lessonId={lesson.id} /> : null}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-line bg-surface px-4">
        <Logo className="hidden sm:flex" />
        <div className="min-w-0 flex-1 border-l border-line pl-4">
          <p className="truncate text-sm font-semibold">{ctx.course.title}</p>
          <div className="mt-1 flex max-w-xs items-center gap-2"><Progress value={ctx.percent} className="h-1.5" /><span className="text-[11px] font-semibold text-ink-muted">{ctx.percent}%</span></div>
        </div>
        <Link href={`/dashboard/learning/${slug}`} className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-white/[0.06]" aria-label="Exit lesson"><X className="size-5" /></Link>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-80 shrink-0 overflow-y-auto border-r border-line bg-surface lg:block" style={{ maxHeight: "calc(100vh - 56px)", position: "sticky", top: 56 }}>
          <nav aria-label="Course contents" className="py-3">
            {ctx.modules.map((m, mi) => (
              <div key={m.id} className="mb-2">
                <p className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-ink-muted">{mi + 1}. {m.title}</p>
                <ul>
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <Link href={`/learn/${slug}/${l.id}`} aria-current={l.id === lesson.id ? "page" : undefined} className={cn("flex items-start gap-2.5 px-4 py-2 text-[13px]", l.id === lesson.id ? "bg-brand-500/10 font-semibold text-brand-300" : "text-ink-soft hover:bg-white/[0.03]")}>
                        {l.completed ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" />}
                        <span>{l.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8">
          <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{titleCase(lesson.type)}</Badge>{lesson.duration_minutes ? <span className="text-[12.5px] text-ink-muted">{lesson.duration_minutes} min</span> : null}</div>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{lesson.title}</h1>

          <div className="mt-6 space-y-6">
            {lesson.type === "video" ? <LessonVideo provider={lesson.video_provider} assetId={lesson.video_asset_id} title={lesson.title} /> : null}
            {lesson.content_md ? <div className="rounded-2xl border border-line bg-surface p-6"><Markdown source={lesson.content_md} /></div> : null}
            {lesson.type === "external" && lesson.external_url ? (
              <a href={lesson.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-2xl border border-line bg-surface p-5 hover:border-brand-300">
                <span className="font-medium">Open external resource</span><ExternalLink className="size-4 text-brand-300" />
              </a>
            ) : null}

            {quiz ? <QuizRunner quiz={quiz} enrolled={enrolled} /> : lesson.type === "quiz" ? <Alert tone="info">The quiz for this lesson hasn&apos;t been published yet.</Alert> : null}
            {assignment ? <AssignmentPanel assignment={assignment} submission={submission} courseId={ctx.course.id} enrolled={enrolled} /> : null}

            {resources?.length ? (
              <section className="rounded-2xl border border-line bg-surface p-5">
                <h2 className="text-[15px] font-semibold">Resources</h2>
                <ul className="mt-3 space-y-2">
                  {resources.map((r) => (
                    <li key={r.id}>
                      <a href={`/api/resources/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-sm hover:border-brand-300 hover:bg-brand-500/[0.06]" rel="noopener">
                        <FileText className="size-4 text-brand-300" /><span className="flex-1">{r.title}</span>
                        {r.kind === "link" ? <ExternalLink className="size-4 text-ink-muted" /> : <Download className="size-4 text-ink-muted" />}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            {prev ? <ButtonLink href={`/learn/${slug}/${prev.id}`} variant="secondary"><ArrowLeft className="size-4" />Previous</ButtonLink> : <span />}
            <div className="flex flex-col gap-3 sm:flex-row">
              {enrolled ? <CompleteButton lessonId={lesson.id} completed={lesson.completed} path={`/learn/${slug}/${lesson.id}`} /> : null}
              {next ? <ButtonLink href={`/learn/${slug}/${next.id}`}>Next lesson<ArrowRight className="size-4" /></ButtonLink> : <ButtonLink href={`/dashboard/learning/${slug}`}>Finish<CheckCircle2 className="size-4" /></ButtonLink>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
