import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CertificateView } from "@/components/certificate";
import { Alert } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { PrintButton } from "./print-button";

export const metadata = { title: "Certificate" };

export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const user = await requireUser("/dashboard/certificates");
  const supabase = await createClient();
  // RLS: only the owner (or admin / course instructor) can read the row.
  const { data: cert } = await supabase.from("certificates").select("certificate_code, student_name, course_title, issued_at, status, revoked_reason").eq("certificate_code", code.toUpperCase()).maybeSingle();
  if (!cert) notFound();
  return (
    <div className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard/certificates" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:underline"><ArrowLeft className="size-4" />All certificates</Link>
        <div className="flex gap-2">
          <ButtonLink href={`/verify/${cert.certificate_code}`} variant="secondary" target="_blank"><ExternalLink className="size-4" />Public verification page</ButtonLink>
          <PrintButton />
        </div>
      </div>
      {cert.status === "revoked" ? <Alert tone="danger" title="This certificate has been revoked" className="no-print">{cert.revoked_reason}</Alert> : null}
      <CertificateView cert={cert} />
      <p className="no-print text-center text-[13px] text-ink-muted">Tip: use “Download / Print” and choose “Save as PDF”, landscape orientation. {user.profile.full_name !== cert.student_name ? "The name shown is the name on your profile when the certificate was issued." : null}</p>
    </div>
  );
}
