import { requireInstructor } from "@/lib/auth/dal";
import { SubmissionsView } from "@/components/editor/submissions";

export default async function InstructorSubmissions({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireInstructor();
  return <SubmissionsView base="/instructor" courseId={id} />;
}
