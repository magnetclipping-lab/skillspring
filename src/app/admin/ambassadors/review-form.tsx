"use client";
import { useActionState } from "react";
import { Select, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { adminReviewAmbassadorAction } from "@/lib/actions/ambassador";

const STATUSES = ["applied", "shortlisted", "active", "rejected", "inactive"] as const;

export function AmbassadorReviewForm({ id, status, notes }: { id: string; status: string; notes: string | null }) {
  const [state, action] = useActionState<ActionState, FormData>(adminReviewAmbassadorAction, null);
  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-start">
      <input type="hidden" name="id" value={id} />
      <Select name="status" defaultValue={status} aria-label="Status">
        {STATUSES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
      </Select>
      <Textarea name="admin_notes" defaultValue={notes ?? ""} rows={1} maxLength={2000} placeholder="Private notes" aria-label="Notes" />
      <SubmitButton size="sm" variant="secondary">Save</SubmitButton>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
