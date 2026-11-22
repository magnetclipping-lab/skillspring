"use client";
import { useActionState, useOptimistic, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Field, Input, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { FileUpload } from "@/components/ui/file-upload";
import { applyToInternshipAction, toggleSaveInternshipAction } from "@/lib/actions/internships";

export function ApplyForm({ internshipId, defaultPhone }: { internshipId: string; defaultPhone: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(applyToInternshipAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <Card className="p-6">
      <form action={action} className="space-y-4">
        <FormMessage state={state} />
        <input type="hidden" name="internship_id" value={internshipId} />
        <FileUpload kind="resume" name="resume_path" accept="application/pdf" label="Resume (PDF, max 5 MB)" help="Optional, but recommended" />
        <Field label="Why are you a good fit?" name="cover_letter" error={state?.errors?.cover_letter} required>
          <Textarea id="cover_letter" name="cover_letter" rows={6} maxLength={5000} required placeholder="Tell us about relevant coursework, projects and what you hope to learn." />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" name="phone" error={state?.errors?.phone}>
            <Input id="phone" name="phone" type="tel" defaultValue={defaultPhone ?? ""} autoComplete="tel" />
          </Field>
          <Field label="Portfolio / LinkedIn URL" name="portfolio_url" error={state?.errors?.portfolio_url}>
            <Input id="portfolio_url" name="portfolio_url" type="url" placeholder="https://" />
          </Field>
        </div>
        <SubmitButton pendingText="Submitting…">Submit application</SubmitButton>
      </form>
    </Card>
  );
}

export function SaveButton({ internshipId, slug, saved }: { internshipId: string; slug: string; saved: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" disabled={pending} onClick={() => start(async () => { setOptimistic(!optimistic); await toggleSaveInternshipAction(internshipId, slug); })}>
      {optimistic ? <BookmarkCheck className="size-4 text-brand-600" /> : <Bookmark className="size-4" />}
      {optimistic ? "Saved" : "Save for later"}
    </Button>
  );
}
