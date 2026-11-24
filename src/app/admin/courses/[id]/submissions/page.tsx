import { requireAdmin } from "@/lib/auth/dal";
import { SubmissionsView } from "@/components/editor/submissions";

export default async function AdminSubmissions({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string }> }) {
  const { id } = await params;
  const { f } = await searchParams;
  await requireAdmin();
  return <SubmissionsView base="/admin" courseId={id} filter={f} />;
}
