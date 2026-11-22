"use client";
import { useActionState } from "react";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { applyAsInstructorAction } from "@/lib/actions/account";
import type { InstructorProfile } from "@/lib/types";

export function InstructorApplicationForm({ existing, defaultName }: { existing?: InstructorProfile | null; defaultName?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(applyAsInstructorAction, null);
  const e = state?.errors ?? {};
  if (state?.ok && !existing) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Display name" name="display_name" error={e.display_name} required><Input id="display_name" name="display_name" defaultValue={existing?.display_name ?? defaultName ?? ""} /></Field>
        <Field label="Headline" name="headline" error={e.headline} required><Input id="headline" name="headline" defaultValue={existing?.headline ?? ""} placeholder="e.g. Chartered Accountant, 8 years in equity research" /></Field>
      </div>
      <Field label="About you and what you'd teach" name="bio" error={e.bio} required><Textarea id="bio" name="bio" rows={6} defaultValue={existing?.bio ?? ""} /></Field>
      <Field label="Areas of expertise" name="expertise" error={e.expertise} help="Comma-separated"><Input id="expertise" name="expertise" defaultValue={existing?.expertise.join(", ") ?? ""} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Website" name="website" error={e.website}><Input id="website" name="website" type="url" placeholder="https://" defaultValue={existing?.website ?? ""} /></Field>
        <Field label="LinkedIn" name="linkedin_url" error={e.linkedin_url}><Input id="linkedin_url" name="linkedin_url" type="url" placeholder="https://linkedin.com/in/…" defaultValue={existing?.linkedin_url ?? ""} /></Field>
      </div>
      <div>
        <Checkbox name="rights_confirmation" defaultChecked={Boolean(existing)} label="I confirm that any material I upload is my original work or that I hold the rights to use it commercially. I understand every course is reviewed for content rights before publication." />
        {e.rights_confirmation ? <p className="mt-1.5 text-[12.5px] text-red-600">{e.rights_confirmation[0]}</p> : null}
      </div>
      <SubmitButton>{existing ? "Update profile" : "Submit application"}</SubmitButton>
    </form>
  );
}
