import Link from "next/link";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { adminRevokeCertificateAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Badge, Input, PageHeader, Table } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificates" };

export default async function AdminCertificates({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("certificates").select("id, certificate_code, student_name, course_title, issued_at, status, revoked_reason").order("issued_at", { ascending: false }).limit(200);
  const term = q.replace(/[%_,()]/g, "").trim().slice(0, 60);
  if (term) query = query.or(`certificate_code.ilike.%${term}%,student_name.ilike.%${term}%,course_title.ilike.%${term}%`);
  const { data } = await query;
  return (
    <>
      <PageHeader title="Certificates" />
      <form className="mb-4 flex max-w-lg gap-2"><Input name="q" defaultValue={q} placeholder="Search by ID, student or course" /><Button type="submit">Search</Button></form>
      <Table>
        <thead><tr><th>ID</th><th>Student</th><th>Course</th><th>Issued</th><th>Status</th><th>Revoke</th></tr></thead>
        <tbody>{(data ?? []).map((c) => (
          <tr key={c.id}><td><Link href={`/verify/${c.certificate_code}`} target="_blank" className="font-mono text-[12.5px] text-brand-300 hover:underline">{c.certificate_code}</Link></td><td>{c.student_name}</td><td>{c.course_title}</td><td>{formatDate(c.issued_at)}</td><td><Badge tone={c.status === "valid" ? "success" : "danger"}>{c.status}</Badge>{c.revoked_reason ? <p className="text-[12px] text-ink-muted">{c.revoked_reason}</p> : null}</td>
            <td>{c.status === "valid" ? <ActionForm action={adminRevokeCertificateAction} className="flex gap-1" compact><input type="hidden" name="id" value={c.id} /><Input name="reason" placeholder="Reason" required className="h-8 w-36 text-xs" /><SubmitButton size="sm" variant="danger">Revoke</SubmitButton></ActionForm> : null}</td></tr>
        ))}</tbody>
      </Table>
    </>
  );
}
