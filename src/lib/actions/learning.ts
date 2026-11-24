"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, quizAnswerSchema, reviewSchema, submissionSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import type { ActionState } from "@/components/ui/form";
import type { ProgressSummary } from "@/lib/types";

/** Postgres error → user-facing message (function errors are written for users). */
function dbMessage(e: { message?: string } | null, fallback = "Something went wrong. Please try again.") {
  if (!e?.message) return fallback;
  if (/permission|not allowed|row-level/i.test(e.message)) return "You don't have permission to do that.";
  return e.message;
}

export async function enrolFreeAction(courseId: string, slug: string): Promise<ActionState> {
  await requireUser(`/courses/${slug}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("enrol_free_course", { p_course_id: courseId });
  if (error) return { ok: false, message: dbMessage(error) };
  redirect(`/dashboard/learning/${slug}`);
}

export async function setLessonCompleteAction(lessonId: string, completed: boolean, path: string): Promise<{ ok: boolean; progress?: ProgressSummary; message?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_lesson", { p_lesson_id: lessonId, p_completed: completed });
  if (error) return { ok: false, message: dbMessage(error) };
  revalidatePath(path);
  return { ok: true, progress: data as ProgressSummary };
}

export type QuizResult = {
  score_pct: number; passed: boolean; correct: number; total: number; points?: number; max_points?: number;
  results: { question_id: string; correct: boolean; explanation: string | null }[];
};

export async function submitQuizAction(quizId: string, answers: Record<string, unknown>) {
  const user = await requireUser();
  if (!/^[0-9a-f-]{36}$/.test(quizId)) return { ok: false as const, message: "Quiz not found." };
  if (!(await rateLimit("quiz", user.id)).ok) return { ok: false as const, message: "Too many attempts. Please wait a few minutes." };
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(answers ?? {}).slice(0, 100)) {
    if (!/^[0-9a-f-]{36}$/.test(k)) continue;
    const parsed = quizAnswerSchema.safeParse(v);
    if (parsed.success) clean[k] = parsed.data;
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_quiz_id: quizId, p_answers: clean });
  if (error) return { ok: false as const, message: dbMessage(error) };
  revalidatePath("/dashboard", "layout");
  return { ok: true as const, result: data as QuizResult };
}

const EXT_OK = (name: string, accepted: string[]) => {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const norm = ext === "jpeg" ? "jpg" : ext;
  return accepted.length === 0 || accepted.includes(norm);
};

export async function submitAssignmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!(await rateLimit("submission", user.id)).ok) return { ok: false, message: "Too many submissions. Please wait a few minutes." };
  const parsed = submissionSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors, message: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const supabase = await createClient();
  const { data: asg } = await supabase
    .from("assignments")
    .select("id, course_id, accepted_types, allow_text, allow_links, allow_file")
    .eq("id", d.assignment_id)
    .maybeSingle();
  if (!asg) return { ok: false, message: "Assignment not found." };
  const text = asg.allow_text ? d.text_response : null;
  const links = asg.allow_links ? d.links : [];
  if (!text && !d.file_path && !links.length) return { ok: false, message: "Upload a file, add a link or write your response before submitting." };
  if (d.file_path) {
    if (!d.file_path.startsWith(`${user.id}/${asg.course_id}/`)) return { ok: false, message: "Invalid file." };
    if (d.file_name && !EXT_OK(d.file_name, (asg.accepted_types as string[]) ?? [])) {
      return { ok: false, message: `This assignment accepts ${(asg.accepted_types as string[]).join(", ").toUpperCase()} files.` };
    }
  }

  const { data: existing } = await supabase.from("assignment_submissions").select("id, status").eq("assignment_id", asg.id).eq("user_id", user.id).maybeSingle();
  if (existing?.status === "approved") return { ok: false, message: "This assignment has already been approved and can't be resubmitted." };
  const payload = { text_response: text, file_path: d.file_path, file_name: d.file_path ? d.file_name : null, links };
  const { error } = existing
    ? await supabase.from("assignment_submissions").update({ ...payload, status: "submitted" }).eq("id", existing.id)
    : await supabase.from("assignment_submissions").insert({ ...payload, assignment_id: asg.id, user_id: user.id, course_id: asg.course_id });
  if (error) return { ok: false, message: dbMessage(error, "Could not submit your work. Please try again.") };
  revalidatePath("/dashboard", "layout");
  revalidatePath("/learn", "layout");
  return { ok: true, message: existing ? "Resubmitted. Your new version is queued for evaluation." : "Submitted. Your work is queued for evaluation — results usually arrive in about an hour." };
}

/** Issues the internal completion record once the course requirements are met (checked in the database). */
export async function claimCompletionAction(courseId: string): Promise<ActionState & { code?: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_certificate", { p_course_id: courseId });
  if (error) return { ok: false, message: dbMessage(error) };
  const r = data as { certificate_code: string; new: boolean };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Completion recorded.", code: r.certificate_code };
}

export async function saveReviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").upsert({ course_id: parsed.data.course_id, user_id: user.id, rating: parsed.data.rating, comment: parsed.data.comment }, { onConflict: "course_id,user_id" });
  if (error) return { ok: false, message: dbMessage(error, "Only enrolled learners can review this course.") };
  revalidatePath(`/courses/${String(fd.get("slug") ?? "")}`);
  return { ok: true, message: "Thanks for your review!" };
}

export async function markNotificationsReadAction() {
  await requireUser();
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/dashboard", "layout");
}
