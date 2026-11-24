"use client";
import { useActionState, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { enrolFreeAction, saveReviewAction } from "@/lib/actions/learning";

export function EnrolFreeButton({ courseId, slug }: { courseId: string; slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await enrolFreeAction(courseId, slug); if (r && !r.ok) setError(r.message ?? "Could not enrol."); })}>
        {pending ? "Enrolling…" : "Enrol for free"}
      </Button>
      {error ? <Alert tone="danger">{error}</Alert> : null}
    </div>
  );
}

export function ReviewForm({ courseId, slug, existing }: { courseId: string; slug: string; existing: { rating: number; comment: string | null } | null }) {
  const [state, action] = useActionState<ActionState, FormData>(saveReviewAction, null);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  return (
    <form action={action} className="space-y-3 rounded-xl border border-line bg-surface p-5">
      <p className="font-semibold">{existing ? "Update your review" : "Review this course"}</p>
      <FormMessage state={state} />
      <input type="hidden" name="course_id" value={courseId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating} />
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
            <Star className={n <= rating ? "size-6 fill-highlight-400 text-highlight-400" : "size-6 text-ink-muted"} />
          </button>
        ))}
      </div>
      <Textarea name="comment" defaultValue={existing?.comment ?? ""} placeholder="What did you find most useful?" maxLength={2000} />
      <SubmitButton disabled={!rating}>Save review</SubmitButton>
    </form>
  );
}
