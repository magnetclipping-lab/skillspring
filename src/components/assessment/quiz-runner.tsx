"use client";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Badge } from "@/components/ui/primitives";
import { submitQuizAction, type QuizResult } from "@/lib/actions/learning";
import { cn } from "@/lib/utils";
import type { QuestionType } from "@/lib/types";

export type QuizQuestion = {
  id: string; qtype: QuestionType; prompt: string; context: string | null; points: number;
  options: string[] | { left: string[]; right: string[] } | null; blanks: number | null;
};
export type QuizData = {
  id: string; title: string; description: string | null; pass_pct: number; max_attempts: number | null;
  attempts_used: number; best_score: number | null; questions: QuizQuestion[];
};
type Answer = number | number[] | string[];

const TYPE_LABEL: Record<QuestionType, string> = {
  single: "Choose one", multi: "Select all that apply", true_false: "True or false", match: "Match the pairs", fill_blank: "Fill in the blank", scenario: "Scenario",
};

function answered(q: QuizQuestion, a: Answer | undefined) {
  if (a === undefined) return false;
  if (q.qtype === "multi") return Array.isArray(a) && a.length > 0;
  if (q.qtype === "match") {
    const left = (q.options as { left: string[] }).left;
    return Array.isArray(a) && left.every((_, i) => typeof (a as number[])[i] === "number" && (a as number[])[i] >= 0);
  }
  if (q.qtype === "fill_blank") return Array.isArray(a) && (a as string[]).filter((x) => x.trim()).length === (q.blanks ?? 1);
  return typeof a === "number";
}

function Choice({ name, type, checked, onChange, disabled, children }: { name: string; type: "radio" | "checkbox"; checked: boolean; onChange: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition", checked ? "border-violet-400 bg-violet-500/10 text-ink" : "border-line text-ink-soft hover:border-white/20")}>
      <input type={type} name={name} className="accent-violet-500" checked={checked} onChange={onChange} disabled={disabled} />
      {children}
    </label>
  );
}

function QuestionInput({ q, value, set, disabled }: { q: QuizQuestion; value: Answer | undefined; set: (a: Answer) => void; disabled: boolean }) {
  if (q.qtype === "multi") {
    const v = (value as number[] | undefined) ?? [];
    return (
      <div className="grid gap-2">
        {(q.options as string[]).map((o, i) => (
          <Choice key={i} name={q.id} type="checkbox" checked={v.includes(i)} disabled={disabled} onChange={() => set(v.includes(i) ? v.filter((x) => x !== i) : [...v, i].sort())}>{o}</Choice>
        ))}
      </div>
    );
  }
  if (q.qtype === "match") {
    const { left, right } = q.options as { left: string[]; right: string[] };
    const v = (value as number[] | undefined) ?? left.map(() => -1);
    return (
      <div className="grid gap-2.5">
        {left.map((l, i) => (
          <div key={i} className="grid items-center gap-2 rounded-lg border border-line px-4 py-2.5 sm:grid-cols-[1fr_1.2fr]">
            <label htmlFor={`${q.id}-${i}`} className="text-sm text-ink">{l}</label>
            <select
              id={`${q.id}-${i}`}
              disabled={disabled}
              value={v[i] ?? -1}
              onChange={(e) => { const next = [...v]; next[i] = Number(e.target.value); set(next); }}
              className="h-9 rounded-md border border-line bg-canvas px-2 text-sm"
            >
              <option value={-1}>Choose a match…</option>
              {right.map((r, j) => <option key={j} value={j}>{r}</option>)}
            </select>
          </div>
        ))}
      </div>
    );
  }
  if (q.qtype === "fill_blank") {
    const n = q.blanks ?? 1;
    const v = (value as string[] | undefined) ?? Array.from({ length: n }, () => "");
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {Array.from({ length: n }, (_, i) => (
          <label key={i} className="text-[13px] text-ink-muted">
            {n > 1 ? `Blank ${i + 1}` : "Your answer"}
            <input
              disabled={disabled}
              value={v[i] ?? ""}
              maxLength={200}
              onChange={(e) => { const next = [...v]; next[i] = e.target.value; set(next); }}
              className="mt-1 h-10 w-full rounded-md border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-violet-400"
              autoComplete="off"
            />
          </label>
        ))}
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      {(q.options as string[]).map((o, i) => (
        <Choice key={i} name={q.id} type="radio" checked={value === i} disabled={disabled} onChange={() => set(i)}>{o}</Choice>
      ))}
    </div>
  );
}

export function QuizRunner({ quiz, enrolled }: { quiz: QuizData; enrolled: boolean }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [used, setUsed] = useState(quiz.attempts_used);
  const [pending, start] = useTransition();
  const remaining = quiz.max_attempts ? quiz.max_attempts - used : null;
  const byId = new Map(result?.results.map((r) => [r.question_id, r]));
  const done = quiz.questions.filter((q) => answered(q, answers[q.id])).length;
  const showExplanations = Boolean(result && (result.passed || remaining === 0));

  return (
    <section className="rounded-xl border border-line bg-surface" aria-labelledby="quiz-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-6">
        <div>
          <h2 id="quiz-title" className="font-display text-lg font-semibold">{quiz.title}</h2>
          {quiz.description ? <p className="mt-1 text-sm text-ink-muted">{quiz.description}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">Pass mark {quiz.pass_pct}%</Badge>
          {quiz.best_score != null ? <Badge tone="success">Best {quiz.best_score}%</Badge> : null}
          {remaining != null ? <Badge>{remaining} attempt{remaining === 1 ? "" : "s"} left</Badge> : null}
        </div>
      </div>
      <div className="p-6">
        {result ? (
          <Alert tone={result.passed ? "success" : "warning"} className="mb-6" title={result.passed ? `Passed — ${result.score_pct}%` : `Not passed yet — ${result.score_pct}%`}>
            {result.correct} of {result.total} questions correct{result.max_points ? ` · ${result.points}/${result.max_points} points` : ""}.{" "}
            {result.passed ? "Explanations are shown below." : "Review the questions marked incorrect and try again."}
          </Alert>
        ) : null}
        {error ? <Alert tone="danger" className="mb-6">{error}</Alert> : null}
        <ol className="space-y-8">
          {quiz.questions.map((q, qi) => {
            const r = byId.get(q.id);
            return (
              <li key={q.id}>
                <fieldset>
                  <legend className="w-full">
                    <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      Q{qi + 1} · {TYPE_LABEL[q.qtype]} · {q.points} pt{q.points > 1 ? "s" : ""}
                      {r ? (r.correct ? <CheckCircle2 className="size-4 text-emerald-400" aria-label="Correct" /> : <XCircle className="size-4 text-red-400" aria-label="Incorrect" />) : null}
                    </span>
                    {q.context ? <span className="mt-3 block rounded-lg border-l-2 border-cyan-400 bg-white/[0.02] px-4 py-3 text-[14px] leading-6 text-ink-soft">{q.context}</span> : null}
                    <span className="mt-3 block font-medium leading-6 text-ink">{q.prompt}</span>
                  </legend>
                  <div className="mt-3">
                    <QuestionInput q={q} value={answers[q.id]} set={(a) => setAnswers((x) => ({ ...x, [q.id]: a }))} disabled={!enrolled || pending || remaining === 0} />
                  </div>
                  {r?.explanation && showExplanations ? <p className="mt-2.5 text-[13px] leading-6 text-ink-muted">{r.explanation}</p> : null}
                </fieldset>
              </li>
            );
          })}
        </ol>
        {enrolled ? (
          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-line pt-6">
            <Button
              disabled={pending || done < quiz.questions.length || remaining === 0}
              onClick={() => start(async () => {
                setError(null);
                const r = await submitQuizAction(quiz.id, answers);
                if (r.ok) { setResult(r.result); setUsed((u) => u + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } else setError(r.message);
              })}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}{result ? "Submit another attempt" : "Submit answers"}
            </Button>
            <span className="text-[13px] text-ink-muted">{done}/{quiz.questions.length} answered</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
