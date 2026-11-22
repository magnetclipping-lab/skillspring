import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, type BadgeTone, EmptyState, PageHeader, Table } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { InternshipKindBadge } from "@/components/site/cards";
import { formatDate, titleCase } from "@/lib/utils";
import { WithdrawButton } from "./withdraw-button";
import type { Internship } from "@/lib/types";

export const metadata = { title: "Applications" };

const tone: Record<string, BadgeTone> = { submitted: "brand", under_review: "brand", shortlisted: "violet", interview_scheduled: "violet", selected: "success", rejected: "danger", withdrawn: "neutral" };

export default async function ApplicationsPage() {
  const user = await requireUser("/dashboard/applications");
  const supabase = await createClient();
  const { data } = await supabase
    .from("internship_applications")
    .select("id, status, status_note, status_updated_at, created_at, internship:internships(title, slug, kind)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  const apps = (data ?? []) as unknown as { id: string; status: string; status_note: string | null; status_updated_at: string | null; created_at: string; internship: Pick<Internship, "title" | "slug" | "kind"> | null }[];
  return (
    <>
      <PageHeader title="Internship applications" description="Track the status of everything you've applied to." />
      {apps.length ? (
        <Table>
          <thead><tr><th>Opportunity</th><th>Applied</th><th>Status</th><th>Last update</th><th /></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>
                  <Link href={`/internships/${a.internship?.slug}`} className="font-medium hover:text-brand-700">{a.internship?.title}</Link>
                  <div className="mt-1">{a.internship ? <InternshipKindBadge kind={a.internship.kind} /> : null}</div>
                </td>
                <td>{formatDate(a.created_at)}</td>
                <td><Badge tone={tone[a.status]}>{titleCase(a.status)}</Badge>{a.status_note ? <p className="mt-1 max-w-xs text-[12px] text-ink-muted">{a.status_note}</p> : null}</td>
                <td>{formatDate(a.status_updated_at ?? a.created_at)}</td>
                <td className="text-right">{["submitted", "under_review", "shortlisted", "interview_scheduled"].includes(a.status) ? <WithdrawButton id={a.id} /> : null}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<ClipboardList className="size-5" />} title="No applications yet" description="Find an internship or project experience and apply in minutes." action={<ButtonLink href="/internships">Browse opportunities</ButtonLink>} />
      )}
    </>
  );
}
