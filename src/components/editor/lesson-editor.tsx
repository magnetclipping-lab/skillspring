import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteLessonAction, deleteQuestionAction, deleteResourceAction } from "@/lib/actions/course-content";
import { Alert, Badge, Card, CardHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form";
import { AssignmentForm, LessonForm, QuestionForm, QuizForm, ResourceForm } from "./forms";
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
      <Link href={`${base}/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" />Back to course</Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{l.title}</h1>
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
                    {editable ? <form action={deleteResourceAction}>{hidden({ id: r.id })}<button className="text-ink-muted hover:text-red-600" aria-label="Delete resource"><Trash2 className="size-4" /></button></form> : null}
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
                        <div className="flex items-start gap-2"><span className="font-semibold">{i + 1}.</span><span className="flex-1">{q.prompt}</span>
                          {editable ? <form action={deleteQuestionAction}>{hidden({ id: q.id })}<button className="text-ink-muted hover:text-red-600" aria-label="Delete question"><Trash2 className="size-4" /></button></form> : null}
                        </div>
                        <ul className="mt-2 space-y-1 pl-5">{(q.options as string[]).map((o, oi) => <li key={oi} className={oi === q.correct_index ? "font-semibold text-emerald-700" : "text-ink-soft"}>{oi === q.correct_index ? "✓ " : "• "}{o}</li>)}</ul>
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
          <Card>
            <CardHeader title="Assignment" />
            <div className="p-5">{editable ? <AssignmentForm base={base} courseId={courseId} lessonId={lessonId} assignment={assignment} /> : assignment ? <p className="whitespace-pre-line text-sm">{assignment.instructions}</p> : <p className="text-sm text-ink-muted">No assignment.</p>}</div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
