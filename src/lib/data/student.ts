import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types";

export type EnrolledCourse = {
  enrolment_id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
  last_lesson_id: string | null;
  last_accessed_at: string | null;
  course: Pick<Course, "id" | "slug" | "title" | "subtitle" | "thumbnail_url" | "duration_minutes" | "level">;
  total: number;
  completed: number;
  percent: number;
  lastLessonTitle: string | null;
};

/** The caller's enrolments with progress computed from lessons + lesson_progress (both RLS-scoped). */
export async function getMyCourses(userId: string): Promise<EnrolledCourse[]> {
  const supabase = await createClient();
  const { data: enrolments } = await supabase
    .from("enrolments")
    .select("id, status, enrolled_at, completed_at, last_lesson_id, last_accessed_at, course:courses(id, slug, title, subtitle, thumbnail_url, duration_minutes, level)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("last_accessed_at", { ascending: false, nullsFirst: false });
  const rows = (enrolments ?? []) as unknown as (Omit<EnrolledCourse, "course" | "total" | "completed" | "percent" | "lastLessonTitle" | "enrolment_id"> & { id: string; course: EnrolledCourse["course"] })[];
  if (!rows.length) return [];
  const courseIds = rows.map((r) => r.course.id);
  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabase.from("lessons").select("id, course_id, title").in("course_id", courseIds),
    supabase.from("lesson_progress").select("lesson_id, course_id, completed_at").eq("user_id", userId).in("course_id", courseIds),
  ]);
  const lessonTitle = new Map((lessons ?? []).map((l) => [l.id, l.title as string]));
  return rows.map((r) => {
    const total = (lessons ?? []).filter((l) => l.course_id === r.course.id).length;
    const completed = (progress ?? []).filter((p) => p.course_id === r.course.id && p.completed_at).length;
    return {
      enrolment_id: r.id, status: r.status, enrolled_at: r.enrolled_at, completed_at: r.completed_at,
      last_lesson_id: r.last_lesson_id, last_accessed_at: r.last_accessed_at, course: r.course,
      total, completed, percent: total ? Math.round((completed / total) * 100) : 0,
      lastLessonTitle: r.last_lesson_id ? lessonTitle.get(r.last_lesson_id) ?? null : null,
    };
  });
}

export async function getUnreadCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}
