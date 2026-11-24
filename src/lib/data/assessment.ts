import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PanelAssignment, PanelHistory, PanelSubmission } from "@/components/assessment/assignment-panel";

const ASSIGNMENT_COLS =
  "id, course_id, lesson_id, module_id, title, kind, summary, scenario, instructions, deliverables, submission_requirements, rubric, max_score, pass_pct, template_path, template_name, accepted_types, allow_text, allow_links, allow_file, is_mandatory, estimated_minutes, ai_evaluation, position";
const SUBMISSION_COLS =
  "id, assignment_id, course_id, status, eval_status, version, text_response, file_path, file_name, links, feedback, score, max_score, score_source, ai_criteria, submitted_at, evaluate_after, evaluated_at, created_at";

type Row = Record<string, unknown>;

export function toPanelAssignment(a: Row): PanelAssignment {
  return {
    id: a.id as string, title: a.title as string, kind: a.kind as PanelAssignment["kind"], summary: (a.summary as string) ?? null, scenario: (a.scenario as string) ?? null,
    instructions: (a.instructions as string) ?? "", deliverables: (a.deliverables as string) ?? null, submission_requirements: (a.submission_requirements as string) ?? null,
    rubric: (a.rubric as PanelAssignment["rubric"]) ?? [], max_score: (a.max_score as number) ?? 100, pass_pct: (a.pass_pct as number) ?? 50,
    template_name: (a.template_name as string) ?? null, has_template: Boolean(a.template_path), accepted_types: (a.accepted_types as string[]) ?? [],
    allow_text: Boolean(a.allow_text), allow_links: Boolean(a.allow_links), allow_file: a.allow_file !== false, is_mandatory: Boolean(a.is_mandatory),
    estimated_minutes: (a.estimated_minutes as number) ?? null, ai_evaluation: a.ai_evaluation !== false,
  };
}

export function toPanelSubmission(s: Row | null): PanelSubmission | null {
  if (!s) return null;
  return {
    id: s.id as string, status: s.status as string, eval_status: (s.eval_status as PanelSubmission["eval_status"]) ?? "pending", version: (s.version as number) ?? 1,
    text_response: (s.text_response as string) ?? null, file_path: (s.file_path as string) ?? null, file_name: (s.file_name as string) ?? null, links: (s.links as string[]) ?? [],
    feedback: (s.feedback as string) ?? null, score: s.score == null ? null : Number(s.score), max_score: (s.max_score as number) ?? null,
    score_source: (s.score_source as PanelSubmission["score_source"]) ?? null, ai_criteria: (s.ai_criteria as PanelSubmission["ai_criteria"]) ?? null,
    submitted_at: (s.submitted_at as string) ?? (s.created_at as string) ?? null, evaluate_after: (s.evaluate_after as string) ?? null, evaluated_at: (s.evaluated_at as string) ?? null,
  };
}

/** The assignment attached to a lesson, with the caller's submission and version history (RLS-scoped). */
export async function getLessonAssignment(lessonId: string, userId: string) {
  const supabase = await createClient();
  const { data: a } = await supabase.from("assignments").select(ASSIGNMENT_COLS).eq("lesson_id", lessonId).maybeSingle();
  if (!a) return null;
  const { data: s } = await supabase.from("assignment_submissions").select(SUBMISSION_COLS).eq("assignment_id", a.id).eq("user_id", userId).maybeSingle();
  let history: PanelHistory = [];
  if (s) {
    const { data: h } = await supabase.from("submission_history").select("version, submitted_at, file_name, links, text_response").eq("submission_id", s.id).order("version", { ascending: false });
    history = (h ?? []).map((x) => ({ version: x.version, submitted_at: x.submitted_at, file_name: x.file_name, links: x.links ?? [], has_text: Boolean(x.text_response) }));
  }
  return { assignment: toPanelAssignment(a), submission: toPanelSubmission(s), history };
}

export type MyAssignmentRow = {
  assignment: PanelAssignment & { course_id: string; lesson_id: string | null };
  course: { slug: string; title: string };
  submission: PanelSubmission | null;
};

/** Every assignment in the caller's active courses, with their submission (if any). */
export async function getMyAssignments(userId: string): Promise<MyAssignmentRow[]> {
  const supabase = await createClient();
  const { data: enr } = await supabase.from("enrolments").select("course_id, course:courses(slug, title)").eq("user_id", userId).eq("status", "active");
  const courses = new Map(((enr ?? []) as unknown as { course_id: string; course: { slug: string; title: string } }[]).map((e) => [e.course_id, e.course]));
  if (!courses.size) return [];
  const ids = [...courses.keys()];
  const [{ data: asg }, { data: subs }] = await Promise.all([
    supabase.from("assignments").select(ASSIGNMENT_COLS).in("course_id", ids).order("position"),
    supabase.from("assignment_submissions").select(SUBMISSION_COLS).eq("user_id", userId).in("course_id", ids),
  ]);
  const byA = new Map((subs ?? []).map((s) => [s.assignment_id as string, s]));
  return (asg ?? []).map((a) => ({
    assignment: { ...toPanelAssignment(a), course_id: a.course_id as string, lesson_id: (a.lesson_id as string) ?? null },
    course: courses.get(a.course_id as string)!,
    submission: toPanelSubmission(byA.get(a.id as string) ?? null),
  }));
}

export type HistoryRow = {
  id: string; version: number; submitted_at: string; file_name: string | null; links: string[]; has_text: boolean;
  assignment: { id: string; title: string; kind: string; lesson_id: string | null }; course: { slug: string; title: string };
  evaluation: { score: number | null; max_score: number | null; evaluator: string; created_at: string } | null;
};

/** All versions the caller has submitted, newest first, with the evaluation of each version if any. */
export async function getMySubmissionHistory(userId: string, limit = 200): Promise<HistoryRow[]> {
  const supabase = await createClient();
  const { data: subs } = await supabase
    .from("assignment_submissions")
    .select("id, assignment:assignments(id, title, kind, lesson_id), course:courses(slug, title)")
    .eq("user_id", userId);
  const list = (subs ?? []) as unknown as { id: string; assignment: HistoryRow["assignment"]; course: HistoryRow["course"] }[];
  if (!list.length) return [];
  const ids = list.map((s) => s.id);
  const [{ data: hist }, { data: evals }] = await Promise.all([
    supabase.from("submission_history").select("id, submission_id, version, submitted_at, file_name, links, text_response").in("submission_id", ids).order("submitted_at", { ascending: false }).limit(limit),
    supabase.from("assignment_evaluations").select("submission_id, version, score, max_score, evaluator, created_at").in("submission_id", ids).order("created_at", { ascending: false }),
  ]);
  const meta = new Map(list.map((s) => [s.id, s]));
  return (hist ?? []).map((h) => {
    const ev = (evals ?? []).find((e) => e.submission_id === h.submission_id && e.version === h.version) ?? null;
    const m = meta.get(h.submission_id)!;
    return {
      id: h.id, version: h.version, submitted_at: h.submitted_at, file_name: h.file_name, links: h.links ?? [], has_text: Boolean(h.text_response),
      assignment: m.assignment, course: m.course,
      evaluation: ev ? { score: ev.score == null ? null : Number(ev.score), max_score: ev.max_score, evaluator: ev.evaluator, created_at: ev.created_at } : null,
    };
  });
}

export type QuizAttemptRow = { id: string; score_pct: number; passed: boolean; created_at: string; quiz: { id: string; title: string; lesson_id: string | null; course: { slug: string; title: string } } };

export async function getMyQuizAttempts(userId: string): Promise<QuizAttemptRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("quiz_attempts")
    .select("id, score_pct, passed, created_at, quiz:quizzes(id, title, lesson_id, course:courses(slug, title))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as unknown as QuizAttemptRow[];
}
