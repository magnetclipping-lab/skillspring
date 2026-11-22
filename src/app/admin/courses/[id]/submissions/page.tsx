import { requireAdmin } from "@/lib/auth/dal";
import { SubmissionsView } from "@/components/editor/submissions";

export default async function AdminSubmissions({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  return <SubmissionsView base="/admin" courseId={id} />;
}
