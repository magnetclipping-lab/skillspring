"use client";
import { useActionState, useEffect, useState, useTransition } from "react";
import { CheckCircle2, Circle, ClipboardList, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { FileUpload } from "@/components/ui/file-upload";
import { setLessonCompleteAction, submitAssignmentAction, submitQuizAction } from "@/lib/actions/learning";
import { touchLessonAction } from "./actions";
import { cn, titleCase } from "@/lib/utils";

export function TouchLesson({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    void touchLessonAction(lessonId);
  }, [lessonId]);
  return null;
}

export function CompleteButton({ lessonId, completed, path }: { lessonId: string; completed: boolean; path: string }) {
  const [done, setDone] = useState(completed);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button
        variant={done ? "secondary" : "primary"}
        disabled={pending}
        onClick={() => start(async () => {
          const r = await setLessonCompleteAction(lessonId, !done, path);
          if (r.ok) setDone(!done);
          else setError(r.message ?? "Could not update progress.");
        })}
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : done ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Circle className="size-4" />}
        {done ? "Completed" : "Mark as complete"}
      </Button>
      {error ? <p className="mt-1 text-[12px] text-red-600">{error}</p> : null}
    </div>
  );
}

export type QuizData = {
  id: string; title: string; description: string | null; pass_pct: number; max_attempts: number | null;
  attempts_used: number; best_score: number | null; questions: { id: string; prompt: string; options: string[] }[];
};

type Result = { score_pct: number; passed: boolean; correct: number; total: number; results: { question_id: string; correct: boolean; explanation: string | null }[] };

export function QuizRunner({ quiz, enrolled }: { quiz: QuizData; enrolled: boolean }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(quiz.attempts_used);
  const [pending, start] = useTransition();
  const remaining = quiz.max_attempts ? quiz.max_attempts - used : null;
  const byId = new Map(result?.results.map((r) => [r.question_id, r]));

  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{quiz.title}</h2>
          {quiz.description ? <p className="text-sm text-ink-muted">{quiz.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2 text-[12px]">
          <Badge tone="brand">Pass mark {quiz.pass_pct}%</Badge>
          {quiz.best_score != null ? <Badge tone="success">Best {quiz.best_score}%</Badge> : null}
          {remaining != null ? <Badge>{remaining} attempt{remaining === 1 ? "" : "s"} left</Badge> : null}
        </div>
      </div>
      {result ? (
        <Alert tone={result.passed ? "success" : "warning"} className="mt-4" title={result.passed ? `Passed — ${result.score_pct}%` : `Not passed — ${result.score_pct}%`}>
          You answered {result.correct} of {result.total} correctly.
        </Alert>
      ) : null}
      {error ? <Alert tone="danger" className="mt-4">{error}</Alert> : null}
      <ol className="mt-5 space-y-5">
        {quiz.questions.map((q, qi) => {
          const r = byId.get(q.id);
          return (
            <li key={q.id}>
              <fieldset>
                <legend className="flex gap-2 font-medium"><span className="text-ink-muted">{qi + 1}.</span>{q.prompt}{r ? (r.correct ? <CheckCircle2 className="size-4 text-emerald-500" aria-label="Correct" /> : <XCircle className="size-4 text-red-500" aria-label="Incorrect" />) : null}</legend>
                <div className="mt-2 grid gap-2">
                  {q.options.map((o, oi) => (
                    <label key={oi} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 text-sm transition", answers[q.id] === oi ? "border-brand-400 bg-brand-50" : "border-line hover:border-brand-200")}>
                      <input type="radio" name={q.id} className="accent-brand-600" checked={answers[q.id] === oi} onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))} disabled={!enrolled || pending} />
                      {o}
                    </label>
                  ))}
                </div>
                {r?.explanation && result?.passed ? <p className="mt-2 text-[13px] text-ink-muted">{r.explanation}</p> : null}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {enrolled ? (
        <Button
          className="mt-6"
          disabled={pending || Object.keys(answers).length < quiz.questions.length || remaining === 0}
          onClick={() => start(async () => {
            setError(null);
            const r = await submitQuizAction(quiz.id, answers);
            if (r.ok) { setResult(r.result); setUsed((u) => u + 1); } else setError(r.message);
          })}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}{result ? "Submit another attempt" : "Submit answers"}
        </Button>
      ) : null}
    </section>
  );
}

export function AssignmentPanel({ assignment, submission, courseId, enrolled }: {
  assignment: { id: string; title: string; instructions: string; allow_file: boolean; is_mandatory: boolean };
  submission: { id: string; status: string; text_response: string | null; file_path: string | null; feedback: string | null } | null;
  courseId: string; enrolled: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(submitAssignmentAction, null);
  const locked = submission?.status === "approved";
  return (
    <section className="rounded-2xl border border-line bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><ClipboardList className="size-5 text-brand-600" />{assignment.title}</h2>
        {submission ? <Badge tone={submission.status === "approved" ? "success" : submission.status === "needs_revision" ? "warning" : "brand"}>{titleCase(submission.status)}</Badge> : assignment.is_mandatory ? <Badge tone="warning">Required</Badge> : null}
      </div>
      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink-soft">{assignment.instructions}</p>
      {submission?.feedback ? <Alert tone="info" className="mt-4" title="Reviewer feedback">{submission.feedback}</Alert> : null}
      {enrolled && !locked ? (
        <form action={action} className="mt-5 space-y-4">
          <FormMessage state={state} />
          <input type="hidden" name="assignment_id" value={assignment.id} />
          <Textarea name="text_response" rows={6} defaultValue={submission?.text_response ?? ""} placeholder="Write your response or paste a link to your work…" maxLength={20000} />
          {assignment.allow_file ? <FileUpload kind="assignment" name="file_path" courseId={courseId} accept=".pdf,.png,.jpg,.jpeg,.zip,.xlsx,.docx" label="Attach a file (optional, max 10 MB)" defaultPath={submission?.file_path} /> : null}
          <SubmitButton pendingText="Submitting…">{submission ? "Resubmit" : "Submit assignment"}</SubmitButton>
        </form>
      ) : locked ? <p className="mt-4 text-sm text-emerald-700">Your submission was approved.</p> : null}
    </section>
  );
}
