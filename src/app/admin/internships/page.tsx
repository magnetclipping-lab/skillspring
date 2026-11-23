import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, PageHeader, Table } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { InternshipKindBadge } from "@/components/site/cards";
import { formatDate, titleCase } from "@/lib/utils";
import type { Internship } from "@/lib/types";

export const metadata = { title: "Internships" };

export default async function AdminInternships() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: apps }] = await Promise.all([
    supabase.from("internships").select("*, employer:employers(name)").order("created_at", { ascending: false }),
    supabase.from("internship_applications").select("internship_id"),
  ]);
  return (
    <>
      <PageHeader title="Internships & projects" actions={<ButtonLink href="/admin/internships/new"><Plus className="size-4" />New listing</ButtonLink>} />
      <Table>
        <thead><tr><th>Title</th><th>Type</th><th>Employer</th><th>Status</th><th>Deadline</th><th>Applications</th></tr></thead>
        <tbody>{((data ?? []) as Internship[]).map((i) => (
          <tr key={i.id}><td><Link href={`/admin/internships/${i.id}`} className="font-medium hover:text-white">{i.title}</Link>{i.is_demo ? <Badge tone="warning" className="ml-2">Demo</Badge> : null}</td><td><InternshipKindBadge kind={i.kind} /></td><td>{i.employer?.name ?? "Proofwork"}</td><td><Badge tone={i.status === "open" ? "success" : "neutral"}>{titleCase(i.status)}</Badge></td><td>{formatDate(i.deadline)}</td><td><Link href={`/admin/applications?internship=${i.id}`} className="font-semibold text-brand-300 hover:underline">{(apps ?? []).filter((a) => a.internship_id === i.id).length}</Link></td></tr>
        ))}</tbody>
      </Table>
    </>
  );
}
