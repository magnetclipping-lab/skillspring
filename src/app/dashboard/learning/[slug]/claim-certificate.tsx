"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { claimCertificateAction } from "@/lib/actions/learning";

export function ClaimCertificate({ courseId, eligible }: { courseId: string; eligible: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div className="space-y-2 pt-1">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Button
        className="w-full"
        disabled={!eligible || pending}
        onClick={() => start(async () => {
          const r = await claimCertificateAction(courseId);
          if (r.ok && r.code) router.push(`/dashboard/certificates/${r.code}`);
          else setError(r.message ?? "Could not issue certificate.");
        })}
      >
        <Award className="size-4" />{pending ? "Issuing…" : eligible ? "Claim certificate" : "Complete requirements to unlock"}
      </Button>
    </div>
  );
}
