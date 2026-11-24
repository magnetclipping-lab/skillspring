import Link from "next/link";
import { ArrowLeft, Link2, Paperclip, RotateCcw, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { evaluateNowAction, requeueEvaluationAction } from "@/lib/actions/course-content";
import { Badge, type BadgeTone, Card, EmptyState } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form";
import { cn, formatDate } from "@/lib/utils";
import { ReviewSubmissionForm } from "./review-form";

const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending evaluation", tone: "brand" }, evaluating: { label: "Evaluating", tone: "brand" }, evaluated: { label: "AI evaluated", tone: "cyan" },
  needs_review: { label: "Needs human review", tone: "warning" }, failed: { label: "Evaluation failed", tone: "danger" }, reviewed: { label: "Reviewed", tone: "success" },
};
const FILTERS = [["", "All"], ["needs_review", "Needs review"], ["pending", "Pending"], ["evaluated", "AI evaluated"], ["reviewed", "Reviewed"]] as const;

type Row = {
  id: string; course_id: string; user_id: string; status: string; eval_status: string; version: number; text_response: string | null; file_path: string | null; file_name: string | null;
  links: string[]; feedback: string | null; score: number | null; max_score: number | null; score_source: string | null; ai_criteria: { criterion: string; score: number; max: number; comment?: string }[] | null;
  submitted_at: string | null; evaluate_after: string | null; assignment: { title: string; kind: string; max_score: number; pass_pct: number } | null; course: { title: string } | null;
};

/**
 * Submission review queue. RLS limits rows to the course's instructor and admins.
 * With no courseId it shows every course (admin review queue).
 */
export async function SubmissionsView({ base, courseId, filter }: { base: "/admin" | "/instructor"; courseId?: string; filter?: string }) {
  const supabase = await createClient();
  let q = supabase
    .from("assignment_submissions")
    .select("id, course_id, user_id, status, eval_status, version, text_response, file_path, file_name, links, feedback, score, max_score, score_source, ai_criteria, submitted_at, evaluate_after, assignment:assignments(title, kind, max_score, pass_pct), course:courses(title)")
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (courseId) q = q.eq("course_id", courseId);
  if (filter === "needs_review") q = q.in("eval_status", ["needs_review", "failed"]);
  else if (filter === "pending") q = q.in("eval_status", ["pending", "evaluating"]);
  else if (filter) q = q.eq("eval_status", filter);
  const [{ data: subs }, { data: course }] = await Promise.all([q, courseId ? supabase.from("courses").select("title").eq("id", courseId).maybeSingle() : Promise.resolve({ data: null })]);
  const rows = (subs ?? []) as unknown as Row[];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const ids = rows.map((r) => r.id);
  const [{ data: people }, { data: evals }] = await Promise.all([
    userIds.length ? supabase.from("profiles").select("id, full_name").in("id", userIds) : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    ids.length ? supabase.from("assignment_evaluations").select("submission_id, version, evaluator, confidence, flagged_for_review, model, created_at").in("submission_id", ids).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const lastEval = (id: string, v: number) => (evals ?? []).find((e) => e.submission_id === id && e.version === v);
  const href = (f: string) => {
    const path = courseId ? `${base}/courses/${courseId}/submissions` : `${base}/submissions`;
    return f ? `${path}?f=${f}` : path;
  };

  return (
    <div className="space-y-6">
      {courseId ? <Link href={`${base}/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 hover:underline"><ArrowLeft className="size-4" />{course?.title ?? "Course"}</Link> : null}
      <div>
        <p className="kicker">Assessment</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{courseId ? "Assignment submissions" : "Review queue"}</h1>
        <p className="mt-1 text-sm text-ink-muted">AI results can be confirmed or overridden. Every evaluation is kept in the history.</p>
      </div>
      <nav aria-label="Filter" className="flex flex-wrap gap-1">
        {FILTERS.map(([v, l]) => <Link key={v} href={href(v)} aria-current={(filter ?? "") === v ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-[13.5px] font-medium", (filter ?? "") === v ? "bg-white/[0.07] text-ink" : "text-ink-soft hover:text-ink")}>{l}</Link>)}
      </nav>
      {!rows.length ? <EmptyState title="No submissions in this view" /> : (
        <div className="space-y-4">
          {rows.map((s) => {
            const st = STATUS[s.eval_status] ?? STATUS.pending;
            const ev = lastEval(s.id, s.version);
            const max = s.max_score ?? s.assignment?.max_score ?? 100;
            return (
              <Card key={s.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{s.assignment?.title}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink-muted">
                      {name.get(s.user_id) || `Learner ${s.user_id.slice(0, 8)}`} · {s.course?.title?.split(" — ")[0]} · v{s.version} · submitted {formatDate(s.submitted_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    {s.score != null && ["evaluated", "reviewed", "needs_review"].includes(s.eval_status) ? <span className="font-mono text-sm">{Math.round(Number(s.score))}/{max}</span> : null}
                  </div>
                </div>
                <div className="grid gap-6 p-5 lg:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-3 text-[13.5px]">
                    {s.file_path ? <a href={`/api/files?type=submission&id=${s.id}`} className="inline-flex items-center gap-1.5 font-semibold text-violet-300 hover:underline"><Paperclip className="size-3.5" />{s.file_name ?? "Download file"}</a> : null}
                    {s.links?.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center gap-1.5 break-all text-ink-soft hover:text-ink"><Link2 className="size-3.5 shrink-0" />{l}</a>)}
                    {s.text_response ? <p className="line-clamp-6 whitespace-pre-line text-ink-soft">{s.text_response}</p> : null}
                    {s.ai_criteria?.length ? (
                      <ul className="divide-y divide-line rounded-lg border border-line">
                        {s.ai_criteria.map((c) => (
                          <li key={c.criterion} className="px-3 py-2">
                            <div className="flex justify-between"><span className="font-medium">{c.criterion}</span><span className="font-mono text-ink-muted">{c.score}/{c.max}</span></div>
                            {c.comment ? <p className="mt-0.5 text-[12.5px] text-ink-muted">{c.comment}</p> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {ev ? <p className="text-[12px] text-ink-muted">Last evaluation: {ev.evaluator === "ai" ? `AI (${ev.model ?? "model"}, ${ev.confidence ?? "?"} confidence)` : "human reviewer"}{ev.flagged_for_review ? " · flagged for review" : ""} · {formatDate(ev.created_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p> : null}
                  </div>
                  <div className="space-y-3">
                    <ReviewSubmissionForm base={base} courseId={s.course_id} id={s.id} max={max} passPct={s.assignment?.pass_pct ?? 50} score={s.score} feedback={s.feedback} />
                    <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                      {["pending", "evaluating"].includes(s.eval_status) ? (
                        <form action={evaluateNowAction}><input type="hidden" name="_base" value={base} /><input type="hidden" name="course_id" value={s.course_id} /><input type="hidden" name="submission_id" value={s.id} /><SubmitButton size="sm" variant="secondary" pendingText="Evaluating…"><Zap className="size-3.5" />Evaluate now</SubmitButton></form>
                      ) : null}
                      {base === "/admin" ? (
                        <form action={requeueEvaluationAction}><input type="hidden" name="_base" value={base} /><input type="hidden" name="course_id" value={s.course_id} /><input type="hidden" name="submission_id" value={s.id} /><SubmitButton size="sm" variant="ghost" pendingText="Queuing…"><RotateCcw className="size-3.5" />Re-run AI evaluation</SubmitButton></form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
