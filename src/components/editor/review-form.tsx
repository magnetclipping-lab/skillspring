"use client";
import { useActionState } from "react";
import { Input, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { reviewSubmissionAction } from "@/lib/actions/course-content";

/** Human review: confirm or override the mark. Saving notifies the learner and records a human evaluation. */
export function ReviewSubmissionForm({ base, courseId, id, max, passPct, score, feedback }: { base: string; courseId: string; id: string; max: number; passPct: number; score: number | null; feedback: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(reviewSubmissionAction, null);
  return (
    <form action={action} className="space-y-2">
      <FormMessage state={state} />
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="submission_id" value={id} />
      <label className="flex items-center gap-2 text-[13px] text-ink-soft">
        Final score
        <Input name="score" type="number" min={0} max={max} step="0.5" defaultValue={score == null ? "" : Math.round(Number(score) * 2) / 2} className="h-9 w-24" required />
        <span className="text-ink-muted">/ {max} · pass {passPct}%</span>
      </label>
      <Textarea name="feedback" rows={3} defaultValue={feedback ?? ""} placeholder="Feedback for the learner" className="min-h-0" required />
      <SubmitButton size="sm">Save human review</SubmitButton>
    </form>
  );
}
