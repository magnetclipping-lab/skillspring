import Link from "next/link";
import { Award } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader, Table } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Certificates" };

export default async function CertificatesPage() {
  const user = await requireUser("/dashboard/certificates");
  const supabase = await createClient();
  const { data } = await supabase.from("certificates").select("id, certificate_code, course_title, issued_at, status, revoked_reason").eq("user_id", user.id).order("issued_at", { ascending: false });
  return (
    <>
      <PageHeader title="Certificates" description="Certificates are issued only after you meet a course's completion requirements." />
      {data?.length ? (
        <Table>
          <thead><tr><th>Course</th><th>Certificate ID</th><th>Issued</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.map((c) => (
              <tr key={c.id}>
                <td className="font-medium">{c.course_title}</td>
                <td className="font-mono text-[13px]">{c.certificate_code}</td>
                <td>{formatDate(c.issued_at)}</td>
                <td>{c.status === "valid" ? <Badge tone="success">Valid</Badge> : <Badge tone="danger">Revoked</Badge>}</td>
                <td className="text-right"><Link href={`/dashboard/certificates/${c.certificate_code}`} className="text-sm font-semibold text-brand-600 hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState icon={<Award className="size-5" />} title="No certificates yet" description="Complete a course's lessons, assignments and quizzes to earn a verifiable certificate." action={<ButtonLink href="/dashboard/learning">Go to my learning</ButtonLink>} />
      )}
    </>
  );
}
