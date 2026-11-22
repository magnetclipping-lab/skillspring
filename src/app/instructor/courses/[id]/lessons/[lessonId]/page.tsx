import { notFound } from "next/navigation";
import { requireInstructor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { LessonEditorView } from "@/components/editor/lesson-editor";

export default async function InstructorLessonEditor({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  const user = await requireInstructor();
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("instructor_id, status").eq("id", id).maybeSingle();
  if (!course || course.instructor_id !== user.instructor.id) notFound();
  return <LessonEditorView base="/instructor" courseId={id} lessonId={lessonId} editable={["draft", "changes_requested"].includes(course.status)} />;
}
