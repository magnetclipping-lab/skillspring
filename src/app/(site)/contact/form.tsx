"use client";
import { useActionState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { contactAction } from "@/lib/actions/account";

export function ContactForm({ defaultTopic = "general" }: { defaultTopic?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(contactAction, null);
  const e = state?.errors ?? {};
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <Field label="Topic" name="topic"><Select id="topic" name="topic" defaultValue={defaultTopic}>
        <option value="general">General enquiry</option><option value="support">Course or account support</option><option value="refund">Refund request</option>
        <option value="partner">Partnership</option><option value="instructor">Teaching</option>
      </Select></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" name="name" error={e.name} required><Input id="name" name="name" autoComplete="name" /></Field>
        <Field label="Email" name="email" error={e.email} required><Input id="email" name="email" type="email" autoComplete="email" /></Field>
      </div>
      <Field label="Organisation (optional)" name="organisation" error={e.organisation}><Input id="organisation" name="organisation" /></Field>
      <Field label="Message" name="message" error={e.message} required><Textarea id="message" name="message" rows={6} maxLength={5000} /></Field>
      <SubmitButton pendingText="Sending…">Send message</SubmitButton>
    </form>
  );
}
