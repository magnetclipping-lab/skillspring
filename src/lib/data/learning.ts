import "server-only";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/lib/auth/dal";
import type { CompletionStatus, Course, Lesson } from "@/lib/types";

export type LearningModule = { id: string; title: string; position: number; lessons: (Lesson & { completed: boolean })[] };

/**
 * Everything the learning UI needs for one course. Access is enforced twice:
 * here (active enrolment, or admin / owning instructor previewing) and by RLS on every table.
 */
export async function getLearningContext(slug: string, user: SessionUser) {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*").eq("slug", slug).maybeSingle();
  if (!course) notFound();
  const c = course as Course;

  const { data: enrolment } = await supabase.from("enrolments").select("id, status, completed_at, last_lesson_id").eq("course_id", c.id).eq("user_id", user.id).maybeSingle();
  const isStaff = user.roles.includes("admin") || (user.instructor?.status === "approved" && c.instructor_id === user.instructor.id);
  if (enrolment?.status !== "active" && !isStaff) redirect(`/courses/${slug}`);

  const [{ data: modules }, { data: lessons }, { data: progress }, { data: certificate }] = await Promise.all([
    supabase.from("course_modules").select("id, title, position, created_at").eq("course_id", c.id).order("position").order("created_at"),
    supabase.from("lessons").select("*").eq("course_id", c.id).order("position").order("created_at"),
    supabase.from("lesson_progress").select("lesson_id, completed_at").eq("course_id", c.id).eq("user_id", user.id),
    supabase.from("certificates").select("certificate_code, status").eq("course_id", c.id).eq("user_id", user.id).maybeSingle(),
  ]);
  const done = new Set((progress ?? []).filter((p) => p.completed_at).map((p) => p.lesson_id));
  const mods: LearningModule[] = (modules ?? []).map((m) => ({
    id: m.id, title: m.title, position: m.position,
    lessons: ((lessons ?? []) as Lesson[]).filter((l) => l.module_id === m.id).map((l) => ({ ...l, completed: done.has(l.id) })),
  }));
  const flat = mods.flatMap((m) => m.lessons);
  const percent = flat.length ? Math.round((flat.filter((l) => l.completed).length / flat.length) * 100) : 0;

  let completion: CompletionStatus | null = null;
  if (enrolment?.status === "active") {
    const { data } = await supabase.rpc("get_completion_status", { p_course_id: c.id });
    completion = data as CompletionStatus;
  }
  return { course: c, enrolment, isStaff, modules: mods, flat, percent, completion, certificate: certificate as { certificate_code: string; status: string } | null };
}
