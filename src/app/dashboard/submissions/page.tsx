import Link from "next/link";
import { History } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getMySubmissionHistory } from "@/lib/data/assessment";
import { EmptyState, PageHeader, Table } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Submission history" };

export default async function SubmissionsPage() {
  const user = await requireUser("/dashboard/submissions");
  const rows = await getMySubmissionHistory(user.id);
  return (
    <>
      <PageHeader eyebrow="Learning" title="Submission history" description="Every version you've submitted, and how each was evaluated." />
      {!rows.length ? (
        <EmptyState icon={<History className="size-5" />} title="No submissions yet" description="Your submitted files, links and written answers will be listed here, version by version." action={<ButtonLink href="/dashboard/assignments">Go to assignments</ButtonLink>} />
      ) : (
        <Table>
          <thead><tr><th>Submitted</th><th>Assignment</th><th>Version</th><th>Contents</th><th>Evaluation</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-ink-muted">{formatDate(r.submitted_at, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td>
                  <Link className="font-medium hover:text-violet-200" href={r.assignment.lesson_id ? `/learn/${r.course.slug}/${r.assignment.lesson_id}` : `/dashboard/learning/${r.course.slug}`}>{r.assignment.title}</Link>
                  <p className="text-[12px] text-ink-muted">{r.course.title.split(" — ")[0]}</p>
                </td>
                <td className="font-mono">v{r.version}</td>
                <td className="text-ink-muted">{[r.file_name, r.links.length ? `${r.links.length} link${r.links.length > 1 ? "s" : ""}` : null, r.has_text ? "written answer" : null].filter(Boolean).join(" · ") || "—"}</td>
                <td>{r.evaluation ? <span className="font-mono">{r.evaluation.score == null ? "—" : Math.round(r.evaluation.score)}/{r.evaluation.max_score}<span className="ml-2 font-sans text-[12px] text-ink-muted">{r.evaluation.evaluator === "human" ? "reviewer" : "AI-assisted"}</span></span> : <span className="text-ink-muted">Not evaluated</span>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}
