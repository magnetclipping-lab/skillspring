"use client";
import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { applyAmbassadorAction } from "@/lib/actions/ambassador";

export function AmbassadorForm({ defaultName, defaultEmail }: { defaultName?: string; defaultEmail?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(applyAmbassadorAction, null);
  const e = state?.errors ?? {};
  if (state?.ok)
    return (
      <div className="rounded-[24px] bg-stock-tint p-8 text-center">
        <CheckCircle2 className="mx-auto size-10 text-stock" />
        <p className="mt-4 font-display text-[24px] font-semibold text-ink">You&apos;re on the list</p>
        <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink-soft">{state.message}</p>
      </div>
    );
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="hidden" aria-hidden><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="full_name" error={e.full_name} required><Input id="full_name" name="full_name" autoComplete="name" defaultValue={defaultName} maxLength={120} /></Field>
        <Field label="Email" name="email" error={e.email} required><Input id="email" name="email" type="email" autoComplete="email" defaultValue={defaultEmail} maxLength={254} /></Field>
        <Field label="Phone (WhatsApp)" name="phone" error={e.phone} required><Input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" maxLength={20} /></Field>
        <Field label="City" name="city" error={e.city} required><Input id="city" name="city" autoComplete="address-level2" maxLength={120} /></Field>
        <Field label="College" name="college" error={e.college} required><Input id="college" name="college" maxLength={200} /></Field>
        <Field label="Course and year" name="course_and_year" error={e.course_and_year} required><Input id="course_and_year" name="course_and_year" placeholder="B.Com, 2nd year" maxLength={120} /></Field>
      </div>
      <Field label="LinkedIn or Instagram profile (optional)" name="social_url" error={e.social_url}><Input id="social_url" name="social_url" type="url" placeholder="https://linkedin.com/in/yourname" maxLength={300} /></Field>
      <Field label="Why do you want to be a Campus Ambassador?" name="motivation" error={e.motivation} required help="Tell us about clubs, events or communities you're part of."><Textarea id="motivation" name="motivation" rows={5} maxLength={2000} /></Field>
      <div>
        <Checkbox name="consent" label="SkillSpring can contact me by email, phone or WhatsApp about this application." />
        {e.consent ? <p className="mt-1 text-[12.5px] text-red-600">{e.consent[0]}</p> : null}
      </div>
      <SubmitButton pendingText="Submitting…" className="h-12 w-full rounded-full bg-ink text-[15px] hover:bg-brand-800">Apply free</SubmitButton>
    </form>
  );
}
