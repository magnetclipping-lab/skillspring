"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import {
  assignmentSchema, courseSchema, formDataToObject, lessonSchema, moduleSchema, questionSchema, quizSchema,
} from "@/lib/validation";
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
  const { price, discount_price, ...rest } = parsed.data;
  const row = { ...rest, price_paise: price, discount_price_paise: discount_price };
  const id = String(fd.get("id") ?? "");
  const supabase = await createClient();
  const b = base(fd);
  if (id) {
    const { error } = await supabase.from("courses").update(row).eq("id", id).select("id").single();
    if (error) return err(error, "Could not save the course.");
    await audit(user.id, "course.updated", "course", id, { by: b });
    revalidatePath(`${b}/courses/${id}`);
    revalidatePath(`/programs/${row.slug}`);
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
  const raw = formDataToObject(fd);
  const parsed = questionSchema.safeParse({ ...raw, correct_index: Number(raw.correct_index ?? 1) - 1 });
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
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
  await requireUser();
  const parsed = assignmentSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const id = String(fd.get("id") ?? "");
  const courseId = String(fd.get("course_id"));
  const res = id
    ? await supabase.from("assignments").update(parsed.data).eq("id", id).select("id").single()
    : await supabase.from("assignments").insert({ ...parsed.data, course_id: courseId }).select("id").single();
  if (res.error) return err(res.error, "Could not save assignment.");
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

export async function reviewSubmissionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const status = String(fd.get("status"));
  if (!["approved", "needs_revision", "submitted"].includes(status)) return { ok: false, message: "Invalid status." };
  const feedback = String(fd.get("feedback") ?? "").slice(0, 2000) || null;
  const supabase = await createClient();
  const { error } = await supabase.from("assignment_submissions").update({ status, feedback }).eq("id", String(fd.get("id"))).select("id").single();
  if (error) return err(error, "Could not save review.");
  revalidatePath(`${base(fd)}/courses/${String(fd.get("course_id"))}/submissions`);
  return { ok: true, message: "Saved." };
}
