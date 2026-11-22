"use server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/** Records "resume learning" position. The database re-checks enrolment. */
export async function touchLessonAction(lessonId: string) {
  if (!/^[0-9a-f-]{36}$/.test(lessonId)) return;
  const user = await getSessionUser();
  if (!user) return;
  const supabase = await createClient();
  await supabase.rpc("touch_lesson", { p_lesson_id: lessonId });
}
