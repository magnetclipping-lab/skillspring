import { requireAdmin } from "@/lib/auth/dal";
import { SubmissionsView } from "@/components/editor/submissions";
import { RunWorkerButton } from "./run-worker";

export const metadata = { title: "Review queue" };

export default async function AdminReviewQueue({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  await requireAdmin();
  return (
    <div className="space-y-6">
      <RunWorkerButton />
      <SubmissionsView base="/admin" filter={f ?? "needs_review"} />
    </div>
  );
}
