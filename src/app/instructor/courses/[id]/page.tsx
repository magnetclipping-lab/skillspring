import { requireInstructor } from "@/lib/auth/dal";
import { CourseEditorView, loadCourseForEditor } from "@/components/editor/course-editor";
import { Alert } from "@/components/ui/primitives";
import { notFound } from "next/navigation";

export default async function InstructorCourseEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireInstructor();
  const data = await loadCourseForEditor(id);
  if (data.course.instructor_id !== user.instructor.id) notFound();
  const editable = ["draft", "changes_requested"].includes(data.course.status);
  const notice = sp.submitted ? <Alert tone="success" title="Submitted for review">An administrator will review your course. You&apos;ll be notified of the decision.</Alert> : sp.error ? <Alert tone="danger">{sp.error}</Alert> : null;
  return <CourseEditorView base="/instructor" data={data} editable={editable} notice={notice} />;
}
