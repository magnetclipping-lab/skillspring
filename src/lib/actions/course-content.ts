"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import {
  assignmentSchema, courseSchema, formDataToObject, lessonSchema, moduleSchema, parseQuestion, quizSchema, reviewOverrideSchema,
} from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { hasAdminClient } from "@/lib/supabase/admin";
import { processEvaluationJobs } from "@/lib/assessment/worker";
import type { ActionState } from "@/components/ui/form";

/**
 * Course authoring for admins and approved instructors. Every write goes through
 * the caller's Supabase session: RLS (can_edit_course) + column guards decide what
 * is allowed — instructors can only edit their own draft / changes-requested courses
 * and can never change status, rights, demo flags or ownership.
 */

const base = (fd: FormData) => (String(fd.get("_base")) === "/admin" ? "/admin" : "/instructor");
const err = (e: { message?: string; code?: string } | null, fallback: string): ActionState => ({
  ok: false,
  message: e?.code === "23505" ? "That slug is already in use." : /row-level|permission|not allowed/i.test(e?.message ?? "") ? "You can't edit this course right now (it may be under review or published)." : e?.message ?? fallback,
});

export async function saveCourseAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = courseSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const { price, discount_price, is_featured, sort_order, ...rest } = parsed.data;
  const isAdmin = user.roles.includes("admin");
  const row = { ...rest, price_paise: price, discount_price_paise: discount_price, ...(isAdmin ? { is_featured, sort_order } : {}) };
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const b = base(fd);
  if (id) {
    const { error } = await supabase.from("courses").update(row).eq("id", id).select("id").single();
    if (error) return err(error, "Could not save the course.");
    await audit(user.id, "course.updated", "course", id, { by: b });
    revalidatePath(`${b}/courses/${id}`);
    revalidatePath(`/courses/${row.slug}`);
    revalidatePath("/courses");
    revalidatePath("/");
    return { ok: true, message: "Course saved." };
  }
  const { data, error } = await supabase.from("courses").insert(row).select("id").single();
  if (error || !data) return err(error, "Could not create the course.");
  await audit(user.id, "course.created", "course", data.id, { by: b });
  redirect(`${b}/courses/${data.id}`);
}

export async function addModuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = moduleSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const courseId = String(fd.get("course_id"));
  const supabase = await createClient();
  const { error } = await supabase.from("course_modules").insert({ ...parsed.data, course_id: courseId });
  if (error) return err(error, "Could not add module.");
  revalidatePath(`${base(fd)}/courses/${courseId}`);
  return { ok: true, message: "Module added." };
}

export async function updateModuleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = moduleSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { error } = await supabase.from("course_modules").update(parsed.data).eq("id", String(fd.get("id"))).select("id").single();
  if (error) return err(error, "Could not update module.");
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}`);
  return { ok: true, message: "Module updated." };
}

export async function deleteModuleAction(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("course_modules").delete().eq("id", String(fd.get("id")));
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}`);
}

export async function saveLessonAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = lessonSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const courseId = String(fd.get("course_id"));
  const { course_id: _c, ...row } = { ...parsed.data, course_id: courseId };
  void _c;
  const res = id
    ? await supabase.from("lessons").update(row).eq("id", id).select("id").single()
    : await supabase.from("lessons").insert({ ...row, course_id: courseId }).select("id").single();
  if (res.error || !res.data) return err(res.error, "Could not save lesson.");
  revalidatePath(`${base(fd)}/courses/${courseId}`);
  if (!id) redirect(`${base(fd)}/courses/${courseId}/lessons/${res.data.id}`);
  return { ok: true, message: "Lesson saved." };
}

export async function deleteLessonAction(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const courseId = String(fd.get("course_id"));
  await supabase.from("lessons").delete().eq("id", String(fd.get("id")));
  revalidatePath(`${base(fd)}/courses/${courseId}`);
  redirect(`${base(fd)}/courses/${courseId}`);
}

export async function addResourceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const title = String(fd.get("title") ?? "").trim().slice(0, 160);
  const storagePath = String(fd.get("storage_path") ?? "");
  const externalUrl = String(fd.get("external_url") ?? "").trim();
  const lessonId = String(fd.get("lesson_id"));
  const courseId = String(fd.get("course_id"));
  if (!title) return { ok: false, message: "Add a title." };
  if (!storagePath && !/^https:\/\//.test(externalUrl)) return { ok: false, message: "Upload a file or add an https:// link." };
  if (storagePath && !storagePath.startsWith(`${courseId}/`)) return { ok: false, message: "Invalid file." };
  const supabase = await createClient();
  const { error } = await supabase.from("lesson_resources").insert({
    lesson_id: lessonId, course_id: courseId, title,
    kind: storagePath ? (storagePath.endsWith(".pdf") ? "pdf" : "file") : "link",
    storage_path: storagePath || null, external_url: storagePath ? null : externalUrl,
    mime_type: String(fd.get("mime_type") ?? "") || null, file_size_bytes: Number(fd.get("file_size") ?? 0) || null,
  });
  if (error) return err(error, "Could not add resource.");
  revalidatePath(`${base(fd)}/courses/${courseId}/lessons/${lessonId}`);
  return { ok: true, message: "Resource added." };
}

export async function deleteResourceAction(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from("lesson_resources").delete().eq("id", String(fd.get("id"))).select("storage_path").maybeSingle();
  if (data?.storage_path) await supabase.storage.from("course-resources").remove([data.storage_path]);
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}/lessons/${String(fd.get("lesson_id"))}`);
}

export async function saveQuizAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = quizSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const courseId = String(fd.get("course_id"));
  const res = id
    ? await supabase.from("quizzes").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("quizzes").insert({ ...parsed.data, course_id: courseId }).select("id").single();
  if (res.error) return err(res.error, "Could not save quiz.");
  revalidatePath(`${base(fd)}/courses/${courseId}`, "layout");
  return { ok: true, message: "Quiz saved." };
}

export async function addQuestionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = parseQuestion(formDataToObject(fd));
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const supabase = await createClient();
  const quizId = String(fd.get("quiz_id"));
  const { count } = await supabase.from("quiz_questions").select("id", { count: "exact", head: true }).eq("quiz_id", quizId);
  const { error } = await supabase.from("quiz_questions").insert({ ...parsed.data, quiz_id: quizId, position: (count ?? 0) + 1 });
  if (error) return err(error, "Could not add question.");
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}`, "layout");
  return { ok: true, message: "Question added." };
}

export async function deleteQuestionAction(fd: FormData) {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("quiz_questions").delete().eq("id", String(fd.get("id")));
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}`, "layout");
}

export async function saveAssignmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = assignmentSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors, message: parsed.error.issues[0]?.message };
  const { answer_key, evaluator_notes, ...fields } = parsed.data;
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const courseId = String(fd.get("course_id"));
  const templatePath = String(fd.get("template_storage_path") ?? "");
  const templateName = String(fd.get("template_file_name") ?? "").replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const removeTemplate = fd.get("remove_template") === "on";
  const row: Record<string, unknown> = { ...fields };
  if (templatePath) {
    if (!templatePath.startsWith(`${courseId}/`)) return { ok: false, message: "Invalid template file." };
    row.template_path = `storage:${templatePath}`;
    row.template_name = templateName || templatePath.split("/").pop();
  } else if (removeTemplate) {
    row.template_path = null;
    row.template_name = null;
  }
  const { data: lesson } = fields.lesson_id ? await supabase.from("lessons").select("module_id").eq("id", fields.lesson_id).maybeSingle() : { data: null };
  if (lesson?.module_id) row.module_id = lesson.module_id;
  const res = id
    ? await supabase.from("assignments").update(row).eq("id", id).select("id").single()
    : await supabase.from("assignments").insert({ ...row, course_id: courseId }).select("id").single();
  if (res.error || !res.data) return err(res.error, "Could not save assignment.");
  if (answer_key !== null || evaluator_notes !== null) {
    const { error } = await supabase.from("assignment_answer_keys").upsert({ assignment_id: res.data.id, answer_key: answer_key ?? "", evaluator_notes }, { onConflict: "assignment_id" });
    if (error) return err(error, "Assignment saved, but the answer key could not be saved.");
  }
  await audit(user.id, id ? "assignment.updated" : "assignment.created", "assignment", res.data.id, { by: base(fd) });
  revalidatePath(`${base(fd)}/courses/${courseId}`, "layout");
  return { ok: true, message: "Assignment saved." };
}

export async function submitForReviewAction(fd: FormData) {
  const user = await requireUser();
  const supabase = await createClient();
  const id = String(fd.get("course_id"));
  const { error } = await supabase.rpc("submit_course_for_review", { p_course_id: id });
  if (!error) await audit(user.id, "course.submitted", "course", id);
  revalidatePath(`${base(fd)}/courses/${id}`);
  redirect(`${base(fd)}/courses/${id}?${error ? `error=${encodeURIComponent(error.message)}` : "submitted=1"}`);
}

/** Human review: sets the final mark and feedback (overrides any AI result; history is kept). */
export async function reviewSubmissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = reviewOverrideSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors, message: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_submission", { p_submission_id: parsed.data.submission_id, p_score: parsed.data.score, p_feedback: parsed.data.feedback });
  if (error) return err(error, "Could not save the review.");
  await audit(user.id, "submission.reviewed", "assignment_submission", parsed.data.submission_id, { score: parsed.data.score });
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}/submissions`);
  revalidatePath("/admin/submissions");
  return { ok: true, message: "Review saved and the learner has been notified." };
}

/** Queues a fresh AI evaluation for the current version (e.g. after fixing a rubric or answer key). */
export async function requeueEvaluationAction(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("submission_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_requeue_evaluation", { p_submission_id: id });
  if (!error) await audit(user.id, "evaluation.requeued", "assignment_submission", id);
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}/submissions`);
  revalidatePath("/admin/submissions");
}

/** Runs evaluation for a pending submission immediately instead of waiting for the scheduled time. */
export async function evaluateNowAction(fd: FormData) {
  const user = await requireUser();
  const id = String(fd.get("submission_id"));
  if (!(await rateLimit("adminEvaluate", user.id)).ok) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_evaluate_now", { p_submission_id: id });
  if (!error && hasAdminClient()) await processEvaluationJobs({ limit: 3, budgetMs: 50_000 }).catch((e) => console.error("[evaluateNow]", e));
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}/submissions`);
  revalidatePath("/admin/submissions");
}
