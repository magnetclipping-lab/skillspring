import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldX, TriangleAlert } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { CertificateView, type CertificateData } from "@/components/certificate";
import { Alert } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Certificate verification", robots: { index: false } };

export default async function VerifyCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = decodeURIComponent(code).toUpperCase();
  type Verified = CertificateData & { revoked_at: string | null; issuer: string };
  let cert: Verified | null = null as Verified | null;
  let limited = false;
  if (isSupabaseConfigured()) {
    limited = !(await rateLimit("verifyCertificate")).ok;
    if (!limited) {
      const supabase = await createClient();
      const { data } = await supabase.rpc("verify_certificate", { p_code: normalized });
      cert = (data as Verified[] | null)?.[0] ?? null;
    }
  }

  return (
    <div className="container-page max-w-4xl py-12">
      {limited ? (
        <Alert tone="warning">Too many verification requests. Please try again in a few minutes.</Alert>
      ) : !cert ? (
        <div className="mx-auto max-w-lg text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-400"><ShieldX className="size-7" /></span>
          <h1 className="mt-5 text-2xl font-bold">No certificate found</h1>
          <p className="mt-2 text-ink-muted">We couldn&apos;t find a Proofwork certificate with ID <span className="font-mono font-semibold text-ink">{normalized.slice(0, 40)}</span>. Check the ID and try again.</p>
          <Link href="/verify" className="mt-6 inline-block font-semibold text-brand-300 hover:underline">Try another ID</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {cert.status === "valid" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <BadgeCheck className="size-6 shrink-0 text-emerald-400" />
              <div>
                <h1 className="text-lg font-bold text-emerald-300">Verified — this certificate is genuine</h1>
                <p className="text-sm text-emerald-300">Issued by {cert.issuer} to <strong>{cert.student_name}</strong> for completing <strong>{cert.course_title}</strong> on {formatDate(cert.issued_at)}.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <TriangleAlert className="size-6 shrink-0 text-red-400" />
              <div>
                <h1 className="text-lg font-bold text-red-300">This certificate has been revoked</h1>
                <p className="text-sm text-red-300">It was revoked on {formatDate(cert.revoked_at)} and is no longer valid.</p>
              </div>
            </div>
          )}
          <CertificateView cert={cert} />
        </div>
      )}
    </div>
  );
}
