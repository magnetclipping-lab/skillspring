import Link from "next/link";
import { Download, Paperclip } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { adminUpdateApplicationAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Badge, EmptyState, Input, PageHeader, Select, Table } from "@/components/ui/primitives";
import { cn, formatDate, titleCase } from "@/lib/utils";

export const metadata = { title: "Applications" };
const statuses = ["submitted", "under_review", "shortlisted", "interview_scheduled", "selected", "rejected", "withdrawn"];

export default async function AdminApplications({ searchParams }: { searchParams: Promise<{ status?: string; internship?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("internship_applications").select("id, status, status_note, cover_letter, phone, portfolio_url, resume_path, created_at, user:profiles(full_name, email, college, degree), internship:internships(id, title, kind)").order("created_at", { ascending: false }).limit(300);
  if (sp.status && statuses.includes(sp.status)) q = q.eq("status", sp.status);
  if (sp.internship && /^[0-9a-f-]{36}$/.test(sp.internship)) q = q.eq("internship_id", sp.internship);
  const { data } = await q;
  type Row = { id: string; status: string; status_note: string | null; cover_letter: string | null; phone: string | null; portfolio_url: string | null; resume_path: string | null; created_at: string; user: { full_name: string; email: string; college: string | null; degree: string | null } | null; internship: { id: string; title: string; kind: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const exportHref = `/api/admin/export/applications${sp.internship ? `?internship=${sp.internship}` : ""}`;
  return (
    <>
      <PageHeader title="Applications" actions={<a href={exportHref} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold ring-1 ring-line hover:bg-brand-50"><Download className="size-4" />Export CSV</a>} />
      <div className="mb-4 flex flex-wrap gap-2">{["", ...statuses].map((s) => <Link key={s} href={`/admin/applications?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(sp.internship ? { internship: sp.internship } : {}) })}`} className={cn("rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset", (sp.status ?? "") === s ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-soft ring-line")}>{s ? titleCase(s) : "All"}</Link>)}</div>
      {rows.length ? (
        <Table>
          <thead><tr><th>Applicant</th><th>Opportunity</th><th>Details</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id} className="align-top">
              <td><p className="font-medium">{a.user?.full_name}</p><p className="text-[12px] text-ink-muted">{a.user?.email}</p><p className="text-[12px] text-ink-muted">{[a.user?.degree, a.user?.college].filter(Boolean).join(" · ")}</p></td>
              <td>{a.internship?.title}<p className="text-[12px] text-ink-muted">{formatDate(a.created_at)}</p></td>
              <td className="max-w-xs text-[13px]"><p className="line-clamp-3">{a.cover_letter}</p>{a.resume_path ? <a href={`/api/files?type=resume&id=${a.id}`} className="mt-1 inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"><Paperclip className="size-3.5" />Resume</a> : null}{a.portfolio_url ? <a href={a.portfolio_url} target="_blank" rel="noopener noreferrer nofollow" className="ml-3 font-semibold text-brand-600 hover:underline">Portfolio</a> : null}</td>
              <td><Badge tone={a.status === "selected" ? "success" : a.status === "rejected" ? "danger" : "brand"}>{titleCase(a.status)}</Badge></td>
              <td className="min-w-56">{a.status !== "withdrawn" ? (
                <ActionForm action={adminUpdateApplicationAction} className="space-y-2" compact>
                  <input type="hidden" name="application_id" value={a.id} />
                  <Select name="status" defaultValue={a.status}>{statuses.filter((s) => s !== "withdrawn").map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</Select>
                  <Input name="note" placeholder="Note to applicant (optional)" defaultValue={a.status_note ?? ""} />
                  <SubmitButton size="sm" variant="secondary">Update</SubmitButton>
                </ActionForm>
              ) : <span className="text-[12px] text-ink-muted">Withdrawn by applicant</span>}</td>
            </tr>
          ))}</tbody>
        </Table>
      ) : <EmptyState title="No applications" />}
    </>
  );
}
