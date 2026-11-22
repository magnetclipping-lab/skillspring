"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, reviewSchema, submissionSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { sendTemplateEmail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import type { ActionState } from "@/components/ui/form";
import type { ProgressSummary } from "@/lib/types";

/** Postgres error → user-facing message (function errors are written for users). */
function dbMessage(e: { message?: string } | null, fallback = "Something went wrong. Please try again.") {
  if (!e?.message) return fallback;
  if (/permission|not allowed|row-level/i.test(e.message)) return "You don't have permission to do that.";
  return e.message;
}

export async function enrolFreeAction(courseId: string, slug: string): Promise<ActionState> {
  await requireUser(`/programs/${slug}`);
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

export async function submitQuizAction(quizId: string, answers: Record<string, number>) {
  const user = await requireUser();
  if (!(await rateLimit("quiz", user.id)).ok) return { ok: false as const, message: "Too many attempts. Please wait a few minutes." };
  const supabase = await createClient();
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers)) if (/^[0-9a-f-]{36}$/.test(k) && Number.isInteger(v) && v >= 0 && v < 8) clean[k] = v;
  const { data, error } = await supabase.rpc("submit_quiz_attempt", { p_quiz_id: quizId, p_answers: clean });
  if (error) return { ok: false as const, message: dbMessage(error) };
  return { ok: true as const, result: data as { score_pct: number; passed: boolean; correct: number; total: number; results: { question_id: string; correct: boolean; explanation: string | null }[] } };
}

export async function submitAssignmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = submissionSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.text_response && !parsed.data.file_path) return { ok: false, message: "Add a written response or upload a file." };
  const supabase = await createClient();
  const { data: asg } = await supabase.from("assignments").select("id, course_id").eq("id", parsed.data.assignment_id).maybeSingle();
  if (!asg) return { ok: false, message: "Assignment not found." };
  if (parsed.data.file_path && !parsed.data.file_path.startsWith(`${user.id}/${asg.course_id}/`)) return { ok: false, message: "Invalid file." };

  const { data: existing } = await supabase.from("assignment_submissions").select("id, status").eq("assignment_id", asg.id).eq("user_id", user.id).maybeSingle();
  const payload = { text_response: parsed.data.text_response, file_path: parsed.data.file_path };
  const { error } = existing
    ? await supabase.from("assignment_submissions").update({ ...payload, status: "submitted" }).eq("id", existing.id)
    : await supabase.from("assignment_submissions").insert({ ...payload, assignment_id: asg.id, user_id: user.id, course_id: asg.course_id });
  if (error) return { ok: false, message: dbMessage(error, "Could not submit. If your submission was approved it can no longer be changed.") };
  revalidatePath("/dashboard/learning", "layout");
  return { ok: true, message: "Assignment submitted." };
}

export async function claimCertificateAction(courseId: string): Promise<ActionState & { code?: string }> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_certificate", { p_course_id: courseId });
  if (error) return { ok: false, message: dbMessage(error) };
  const r = data as { certificate_code: string; new: boolean };
  if (r.new) {
    const { data: course } = await supabase.from("courses").select("title").eq("id", courseId).single();
    await sendTemplateEmail({
      to: user.email,
      template: "certificate_issued",
      dedupeKey: `certificate:${r.certificate_code}`,
      data: {
        name: user.profile.full_name,
        courseTitle: course?.title,
        code: r.certificate_code,
        url: `${publicEnv.siteUrl}/dashboard/certificates/${r.certificate_code}`,
        verifyUrl: `${publicEnv.siteUrl}/verify/${r.certificate_code}`,
      },
    });
  }
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Certificate issued!", code: r.certificate_code };
}

export async function saveReviewAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reviewSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").upsert({ course_id: parsed.data.course_id, user_id: user.id, rating: parsed.data.rating, comment: parsed.data.comment }, { onConflict: "course_id,user_id" });
  if (error) return { ok: false, message: dbMessage(error, "Only enrolled learners can review this course.") };
  revalidatePath(`/programs/${String(fd.get("slug") ?? "")}`);
  return { ok: true, message: "Thanks for your review!" };
}

export async function markNotificationsReadAction() {
  await requireUser();
  const supabase = await createClient();
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/dashboard", "layout");
}
