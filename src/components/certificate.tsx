import { LogoMark } from "@/components/site/logo";
import { publicEnv } from "@/lib/env";
import { formatDate } from "@/lib/utils";

export type CertificateData = { certificate_code: string; student_name: string; course_title: string; issued_at: string; status: string };

/** Printable certificate. Shows exactly the fields required: student, course, date, ID, issuer, verification URL. */
export function CertificateView({ cert }: { cert: CertificateData }) {
  const verifyUrl = `${publicEnv.siteUrl}/verify/${cert.certificate_code}`;
  const revoked = cert.status === "revoked";
  return (
    <div className="relative mx-auto aspect-[1.414/1] w-full max-w-4xl overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#151821,#0b0d12)] shadow-lift ring-1 ring-white/10 print:bg-white print:shadow-none print:ring-0 print:[&_*]:text-[#14163a]">
      <div className="absolute inset-3 rounded-xl border border-marigold-400/40 sm:inset-5" />
      <div className="absolute inset-0 bg-[radial-gradient(40rem_20rem_at_100%_0%,rgb(240_181_68/0.10),transparent),radial-gradient(40rem_20rem_at_0%_100%,rgb(108_118_245/0.12),transparent)]" />
      {revoked ? <div className="absolute inset-0 z-10 grid place-items-center"><span className="-rotate-12 rounded-xl border-4 border-red-500 px-6 py-2 font-display text-3xl font-extrabold uppercase tracking-widest text-red-400/80 sm:text-5xl">Revoked</span></div> : null}
      <div className="relative flex h-full flex-col items-center justify-between px-8 py-8 text-center sm:px-16 sm:py-14">
        <div className="flex items-center gap-2.5"><LogoMark className="size-8 sm:size-10" /><span className="font-display text-lg font-bold sm:text-2xl">Proofwork</span></div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-marigold-400 sm:text-xs">Certificate of completion</p>
          <p className="mt-3 text-xs text-ink-muted sm:mt-5 sm:text-sm">This is to certify that</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink sm:mt-2 sm:text-5xl">{cert.student_name}</p>
          <p className="mt-2 text-xs text-ink-muted sm:mt-4 sm:text-sm">has successfully completed all requirements of the course</p>
          <p className="mt-1 font-display text-base font-semibold text-marigold-300 sm:mt-2 sm:text-2xl">{cert.course_title}</p>
        </div>
        <div className="grid w-full grid-cols-3 items-end gap-4 text-left text-[9px] sm:text-xs">
          <div><p className="font-semibold text-ink">{formatDate(cert.issued_at, { day: "numeric", month: "long", year: "numeric" })}</p><p className="text-ink-muted">Completion date</p></div>
          <div className="text-center"><p className="font-semibold text-ink">Proofwork</p><p className="text-ink-muted">Issuing organisation</p></div>
          <div className="text-right"><p className="font-mono font-semibold text-ink">{cert.certificate_code}</p><p className="text-ink-muted">Certificate ID</p></div>
        </div>
        <p className="text-[9px] text-ink-muted sm:text-[11px]">Verify at <span className="font-medium text-marigold-300">{verifyUrl}</span></p>
      </div>
    </div>
  );
}
