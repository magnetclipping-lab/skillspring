import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteLessonAction, deleteQuestionAction, deleteResourceAction } from "@/lib/actions/course-content";
import { Alert, Badge, Card, CardHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form";
import { AssignmentForm, LessonForm, QuestionForm, QuizForm, ResourceForm, type EditableAssignment } from "./forms";
import type { Lesson } from "@/lib/types";

export async function LessonEditorView({ base, courseId, lessonId, editable }: { base: "/admin" | "/instructor"; courseId: string; lessonId: string; editable: boolean }) {
  if (!/^[0-9a-f-]{36}$/.test(lessonId)) notFound();
  const supabase = await createClient();
  const [{ data: lesson }, { data: modules }, { data: resources }, { data: quiz }, { data: assignment }] = await Promise.all([
    supabase.from("lessons").select("*").eq("id", lessonId).eq("course_id", courseId).maybeSingle(),
    supabase.from("course_modules").select("id, title").eq("course_id", courseId).order("position"),
    supabase.from("lesson_resources").select("*").eq("lesson_id", lessonId).order("created_at"),
    supabase.from("quizzes").select("*").eq("lesson_id", lessonId).maybeSingle(),
    supabase.from("assignments").select("*").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  if (!lesson) notFound();
  const l = lesson as Lesson;
  const { data: questions } = quiz ? await supabase.from("quiz_questions").select("*").eq("quiz_id", quiz.id).order("position") : { data: [] };
  const { data: answerKey } = assignment ? await supabase.from("assignment_answer_keys").select("answer_key, evaluator_notes").eq("assignment_id", assignment.id).maybeSingle() : { data: null };
  const hidden = (extra: Record<string, string>) => (
    <>
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="lesson_id" value={lessonId} />
      {Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
    </>
  );

  return (
    <div className="space-y-6">
      <Link href={`${base}/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 hover:underline"><ArrowLeft className="size-4" />Back to course</Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{l.title}</h1>
        {editable ? <form action={deleteLessonAction}>{hidden({ id: l.id })}<SubmitButton variant="danger" pendingText="Deleting…"><Trash2 className="size-4" />Delete lesson</SubmitButton></form> : null}
      </div>
      {!editable ? <Alert tone="info">This course is locked for editing.</Alert> : null}
      <Card><CardHeader title="Lesson" /><div className="p-5"><LessonForm base={base} lesson={l} modules={modules ?? []} readOnly={!editable} /></div></Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Resources" description="PDFs and files are stored privately and served via short-lived signed links." />
          <div className="space-y-4 p-5">
            {resources?.length ? (
              <ul className="space-y-2">
                {resources.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                    <Download className="size-4 text-ink-muted" /><span className="flex-1">{r.title}</span><Badge>{r.kind}</Badge>
                    {editable ? <form action={deleteResourceAction}>{hidden({ id: r.id })}<button className="text-ink-muted hover:text-red-400" aria-label="Delete resource"><Trash2 className="size-4" /></button></form> : null}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-muted">No resources.</p>}
            {editable ? <ResourceForm base={base} courseId={courseId} lessonId={lessonId} /> : null}
          </div>
        </Card>

        {l.type === "quiz" || quiz ? (
          <Card>
            <CardHeader title="Quiz" description="Correct answers are never sent to students' browsers." />
            <div className="space-y-4 p-5">
              {editable ? <QuizForm base={base} courseId={courseId} lessonId={lessonId} quiz={quiz} /> : quiz ? <p className="text-sm">{quiz.title} · pass {quiz.pass_pct}%</p> : null}
              {quiz ? (
                <>
                  <ol className="space-y-2">
                    {(questions ?? []).map((q, i) => (
                      <li key={q.id} className="rounded-xl border border-line p-3 text-sm">
                        <div className="flex items-start gap-2"><span className="font-semibold">{i + 1}.</span><span className="flex-1">{q.context ? <span className="mb-1 block text-[12.5px] text-ink-muted">{q.context}</span> : null}{q.prompt}<span className="ml-2 text-[11.5px] text-ink-muted">{q.qtype} · {q.points} pt</span></span>
                          {editable ? <form action={deleteQuestionAction}>{hidden({ id: q.id })}<button className="text-ink-muted hover:text-red-400" aria-label="Delete question"><Trash2 className="size-4" /></button></form> : null}
                        </div>
                        <QuestionAnswers q={q} />
                      </li>
                    ))}
                  </ol>
                  {editable ? <QuestionForm base={base} courseId={courseId} quizId={quiz.id} /> : null}
                </>
              ) : null}
            </div>
          </Card>
        ) : null}

        {l.type === "assignment" || assignment ? (
          <Card className="lg:col-span-2">
            <CardHeader title="Assignment" />
            <div className="p-5">{editable ? <AssignmentForm base={base} courseId={courseId} lessonId={lessonId} assignment={assignment as EditableAssignment | null} answerKey={answerKey} /> : assignment ? <p className="whitespace-pre-line text-sm">{assignment.instructions}</p> : <p className="text-sm text-ink-muted">No assignment.</p>}</div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

type QRow = { qtype: string; options: unknown; correct_index: number | null; correct: unknown };

function QuestionAnswers({ q }: { q: QRow }) {
  if (q.qtype === "match") {
    const o = q.options as { left: string[]; right: string[] };
    const c = (q.correct as number[]) ?? [];
    return <ul className="mt-2 space-y-1 pl-5 text-ink-soft">{o.left.map((l, i) => <li key={i}>{l} <span className="text-ink-muted">→</span> <span className="font-semibold text-emerald-300">{o.right[c[i]]}</span></li>)}</ul>;
  }
  if (q.qtype === "fill_blank") {
    return <ul className="mt-2 space-y-1 pl-5 text-ink-soft">{((q.correct as string[][]) ?? []).map((a, i) => <li key={i}>Blank {i + 1}: <span className="font-semibold text-emerald-300">{a.join(" | ")}</span></li>)}</ul>;
  }
  const opts = (q.options as string[]) ?? [];
  const right = q.qtype === "multi" ? new Set((q.correct as number[]) ?? []) : new Set([q.correct_index]);
  return <ul className="mt-2 space-y-1 pl-5">{opts.map((o, oi) => <li key={oi} className={right.has(oi) ? "font-semibold text-emerald-300" : "text-ink-soft"}>{right.has(oi) ? "✓ " : "• "}{o}</li>)}</ul>;
}
