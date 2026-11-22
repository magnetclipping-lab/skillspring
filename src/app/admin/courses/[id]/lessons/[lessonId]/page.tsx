import { requireAdmin } from "@/lib/auth/dal";
import { LessonEditorView } from "@/components/editor/lesson-editor";

export default async function AdminLessonEditor({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  await requireAdmin();
  return <LessonEditorView base="/admin" courseId={id} lessonId={lessonId} editable />;
}
