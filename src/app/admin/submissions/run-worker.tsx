import { runEvaluationWorkerAction } from "@/lib/actions/admin";
import { integrationStatus } from "@/lib/env.server";
import { Alert } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form";

/** Processes due evaluation jobs now (useful before the scheduler is set up, or to catch up). */
export function RunWorkerButton() {
  const s = integrationStatus();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-4">
      {!s.anthropic ? (
        <Alert tone="warning" title="AI evaluation isn't configured">Set ANTHROPIC_API_KEY. Until then, submissions are queued and moved to &ldquo;Needs review&rdquo; for a person to mark — no results are generated automatically.</Alert>
      ) : (
        <p className="text-sm text-ink-soft">Evaluation runs automatically on a schedule. You can also process anything that&apos;s due right now.</p>
      )}
      <form action={runEvaluationWorkerAction}><SubmitButton variant="secondary" pendingText="Processing…">Process due evaluations</SubmitButton></form>
    </div>
  );
}
