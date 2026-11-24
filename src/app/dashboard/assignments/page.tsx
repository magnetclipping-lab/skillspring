import Link from "next/link";
import { ClipboardList, Compass, FileSpreadsheet, FileText, Hammer } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getMyAssignments } from "@/lib/data/assessment";
import { Badge, EmptyState, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { evalLabel } from "@/components/assessment/assignment-panel";
import { cn } from "@/lib/utils";
import type { AssignmentKind } from "@/lib/types";

export const metadata = { title: "Assignments" };

const KIND: Record<AssignmentKind, { label: string; icon: typeof FileText }> = {
  file: { label: "Workbook", icon: FileSpreadsheet }, document: { label: "Written", icon: FileText }, practical: { label: "Practical", icon: Hammer }, scenario: { label: "Scenario", icon: Compass },
};
const FILTERS = [["", "All"], ["todo", "To do"], ["waiting", "Awaiting results"], ["revise", "Needs revision"], ["passed", "Passed"]] as const;

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const user = await requireUser("/dashboard/assignments");
  const all = await getMyAssignments(user.id);
  const list = all.filter((a) => {
    const s = a.submission;
    if (f === "todo") return !s;
    if (f === "waiting") return s && ["pending", "evaluating", "needs_review", "failed"].includes(s.eval_status);
    if (f === "revise") return s?.status === "needs_revision" && ["evaluated", "reviewed"].includes(s.eval_status);
    if (f === "passed") return s?.status === "approved";
    return true;
  });
  const byCourse = new Map<string, typeof list>();
  for (const a of list) byCourse.set(a.course.slug, [...(byCourse.get(a.course.slug) ?? []), a]);

  return (
    <>
      <PageHeader eyebrow="Learning" title="Assignments" description="Every assignment in your courses, with its current status." />
      <nav aria-label="Filter" className="mb-6 flex flex-wrap gap-1">
        {FILTERS.map(([v, l]) => (
          <Link key={v} href={v ? `/dashboard/assignments?f=${v}` : "/dashboard/assignments"} aria-current={(f ?? "") === v ? "page" : undefined} className={cn("rounded-md px-3 py-1.5 text-[13.5px] font-medium", (f ?? "") === v ? "bg-white/[0.07] text-ink" : "text-ink-soft hover:text-ink")}>{l}</Link>
        ))}
      </nav>
      {!all.length ? (
        <EmptyState icon={<ClipboardList className="size-5" />} title="No assignments yet" description="Assignments appear here once you're enrolled in a course." action={<ButtonLink href="/courses">Browse courses</ButtonLink>} />
      ) : !list.length ? (
        <p className="rounded-xl border border-line p-6 text-sm text-ink-muted">Nothing in this view.</p>
      ) : (
        <div className="space-y-8">
          {[...byCourse.entries()].map(([slug, rows]) => (
            <section key={slug} aria-labelledby={`c-${slug}`}>
              <h2 id={`c-${slug}`} className="mb-3 font-display text-lg font-semibold">{rows[0].course.title.split(" — ")[0]}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {rows.map((a) => {
                  const st = evalLabel(a.submission);
                  const K = KIND[a.assignment.kind];
                  const s = a.submission;
                  const scored = s && ["evaluated", "reviewed"].includes(s.eval_status) && s.score != null;
                  return (
                    <li key={a.assignment.id}>
                      <Link href={a.assignment.lesson_id ? `/learn/${slug}/${a.assignment.lesson_id}` : `/dashboard/learning/${slug}`} className="grid items-center gap-3 px-5 py-4 hover:bg-white/[0.02] sm:grid-cols-[1fr_auto_auto]">
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted"><K.icon className="size-3.5" />{K.label}</span>
                          <span className="mt-1 block truncate font-medium">{a.assignment.title}</span>
                        </span>
                        <span className="font-mono text-sm text-ink-soft">{scored ? `${Math.round(Number(s!.score))}/${s!.max_score ?? a.assignment.max_score}` : s ? `v${s.version}` : ""}</span>
                        <Badge tone={st.tone}>{st.label}</Badge>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
