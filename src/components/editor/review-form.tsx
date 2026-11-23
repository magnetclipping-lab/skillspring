"use client";
import { useActionState } from "react";
import { Select, Textarea } from "@/components/ui/primitives";
import { SubmitButton, type ActionState } from "@/components/ui/form";
import { reviewSubmissionAction } from "@/lib/actions/course-content";

export function ReviewSubmissionForm({ base, courseId, id, status, feedback }: { base: string; courseId: string; id: string; status: string; feedback: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(reviewSubmissionAction, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="_base" value={base} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="id" value={id} />
      <Select name="status" defaultValue={status}><option value="submitted">Submitted</option><option value="approved">Approve</option><option value="needs_revision">Needs revision</option></Select>
      <Textarea name="feedback" rows={2} defaultValue={feedback ?? ""} placeholder="Feedback for the learner" className="min-h-0" />
      <div className="flex items-center gap-2"><SubmitButton size="sm" variant="secondary">Save</SubmitButton>{state?.message ? <span className={state.ok ? "text-[12px] text-emerald-300" : "text-[12px] text-red-400"}>{state.message}</span> : null}</div>
    </form>
  );
}
