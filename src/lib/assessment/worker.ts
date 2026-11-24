import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env.server";
import { extractFile, type Extracted } from "./extract";
import { EvaluationError, evaluateWithClaude, type Criterion } from "./evaluate";

/**
 * Durable evaluation worker. Jobs live in public.evaluation_jobs (created by a database trigger
 * when a learner submits) and are claimed with FOR UPDATE SKIP LOCKED, so concurrent runs never
 * process the same job twice; a crashed run's jobs are reclaimed after their lock expires.
 * Superseded versions are ignored by record_evaluation. Called by /api/cron/evaluate
 * (pg_cron / Vercel Cron) and by the admin "Evaluate now" action.
 */

export type JobOutcome = { job: string; submission: string; result: "evaluated" | "needs_review" | "skipped" | "retry" | "failed"; detail?: string };

type Job = { id: string; submission_id: string; version: number; attempts: number };

const MAX_ATTEMPTS = 3;

async function loadFile(db: SupabaseClient, path: string | null, fileName: string | null): Promise<Extracted | null> {
  if (!path) return null;
  const { data, error } = await db.storage.from("assignment-submissions").download(path);
  if (error || !data) throw new EvaluationError(`Could not download the submitted file (${error?.message ?? "missing"}).`, true);
  const buf = Buffer.from(await data.arrayBuffer());
  return extractFile(buf, fileName || path);
}

async function processJob(db: SupabaseClient, job: Job): Promise<JobOutcome> {
  const base = { job: job.id, submission: job.submission_id };
  const { data: sub } = await db
    .from("assignment_submissions")
    .select("id, version, text_response, file_path, file_name, links, assignment:assignments(id, title, kind, instructions, scenario, deliverables, rubric, max_score, pass_pct, ai_evaluation)")
    .eq("id", job.submission_id)
    .maybeSingle();
  if (!sub) {
    await db.rpc("finish_evaluation_job", { p_job_id: job.id, p_status: "cancelled", p_error: "Submission no longer exists" });
    return { ...base, result: "skipped", detail: "submission deleted" };
  }
  if (sub.version !== job.version) {
    await db.rpc("finish_evaluation_job", { p_job_id: job.id, p_status: "cancelled", p_error: "Superseded by a newer version" });
    return { ...base, result: "skipped", detail: "superseded" };
  }
  const a = sub.assignment as unknown as { id: string; title: string; kind: string; instructions: string; scenario: string | null; deliverables: string | null; rubric: Criterion[]; max_score: number; pass_pct: number; ai_evaluation: boolean };

  const apiKey = serverEnv().ANTHROPIC_API_KEY;
  if (!apiKey || !a.ai_evaluation || !a.rubric?.length) {
    const why = !apiKey ? "AI evaluation is not configured (ANTHROPIC_API_KEY missing)" : !a.rubric?.length ? "Assignment has no rubric" : "AI evaluation is off for this assignment";
    await db.rpc("mark_evaluation_failed", { p_submission_id: sub.id, p_version: sub.version, p_reason: why });
    await db.rpc("finish_evaluation_job", { p_job_id: job.id, p_status: "failed", p_error: why });
    return { ...base, result: "needs_review", detail: why };
  }

  try {
    await db.from("assignment_submissions").update({ eval_status: "evaluating" }).eq("id", sub.id).eq("version", sub.version).eq("eval_status", "pending");
    const { data: key } = await db.from("assignment_answer_keys").select("answer_key, evaluator_notes").eq("assignment_id", a.id).maybeSingle();
    const file = await loadFile(db, sub.file_path, sub.file_name);
    const out = await evaluateWithClaude(
      {
        assignment: a,
        answerKey: key?.answer_key ?? null,
        evaluatorNotes: key?.evaluator_notes ?? null,
        submission: { version: sub.version, text: sub.text_response, links: sub.links ?? [], fileName: sub.file_name },
        file,
      },
      { apiKey, model: serverEnv().ANTHROPIC_MODEL },
    );
    const flag = out.flag || file?.kind === "unsupported" || (a.kind === "practical" && !sub.file_path && !(sub.text_response ?? "").trim());
    const { data: rec, error } = await db.rpc("record_evaluation", {
      p_submission_id: sub.id, p_version: sub.version, p_evaluator: "ai", p_reviewer: null, p_score: out.score,
      p_criteria: out.criteria, p_feedback: out.feedback, p_model: out.model, p_confidence: out.confidence, p_flag: flag,
    });
    if (error) throw new EvaluationError(`Could not save the evaluation: ${error.message}`, true);
    await db.rpc("finish_evaluation_job", { p_job_id: job.id, p_status: "done", p_error: flag ? out.flagReason : null });
    if ((rec as { skipped?: boolean })?.skipped) return { ...base, result: "skipped", detail: "superseded" };
    return { ...base, result: flag ? "needs_review" : "evaluated", detail: flag ? out.flagReason ?? undefined : undefined };
  } catch (e) {
    const err = e instanceof EvaluationError ? e : new EvaluationError(e instanceof Error ? e.message : String(e), true);
    if (err.retryable && job.attempts < MAX_ATTEMPTS) {
      await db.from("assignment_submissions").update({ eval_status: "pending" }).eq("id", sub.id).eq("version", sub.version).eq("eval_status", "evaluating");
      await db.rpc("finish_evaluation_job", { p_job_id: job.id, p_status: "retry", p_error: err.message.slice(0, 1000) });
      return { ...base, result: "retry", detail: err.message };
    }
    await db.rpc("mark_evaluation_failed", { p_submission_id: sub.id, p_version: sub.version, p_reason: err.message });
    await db.rpc("finish_evaluation_job", { p_job_id: job.id, p_status: "failed", p_error: err.message.slice(0, 1000) });
    return { ...base, result: "failed", detail: err.message };
  }
}

/** Claims due jobs and processes them sequentially within a time budget. */
export async function processEvaluationJobs({ limit = 3, budgetMs = 240_000 } = {}): Promise<JobOutcome[]> {
  const db = createAdminClient();
  const started = Date.now();
  const outcomes: JobOutcome[] = [];
  const { data: jobs, error } = await db.rpc("claim_evaluation_jobs", { p_limit: limit });
  if (error) throw new Error(`Could not claim evaluation jobs: ${error.message}`);
  for (const job of (jobs ?? []) as Job[]) {
    if (Date.now() - started > budgetMs) {
      // Out of time: hand the job back immediately rather than waiting for the lock to expire.
      await db.rpc("finish_evaluation_job", { p_job_id: job.id, p_status: "retry", p_error: "Deferred: worker time budget reached" });
      continue;
    }
    outcomes.push(await processJob(db, job));
  }
  return outcomes;
}
