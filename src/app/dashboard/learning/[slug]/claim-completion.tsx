"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/primitives";
import { claimCompletionAction } from "@/lib/actions/learning";

export function ClaimCompletion({ courseId, eligible }: { courseId: string; eligible: boolean }) {
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
          const r = await claimCompletionAction(courseId);
          if (r.ok) router.refresh();
          else setError(r.message ?? "Could not record completion.");
        })}
      >
        <CheckCircle2 className="size-4" />{pending ? "Recording…" : eligible ? "Record course completion" : "Complete the requirements first"}
      </Button>
    </div>
  );
}
