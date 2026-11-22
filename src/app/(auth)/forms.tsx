"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Checkbox, Field, Input } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { forgotPasswordAction, loginAction, registerAction, resetPasswordAction } from "./actions";

function PasswordInput({ name, invalid, autoComplete }: { name: string; invalid?: boolean; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input id={name} name={name} type={show ? "text" : "password"} required autoComplete={autoComplete} aria-invalid={invalid} className="pr-10" />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-muted hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label="Email" name="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state?.errors?.email)} />
      </Field>
      <Field label="Password" name="password" error={state?.errors?.password}>
        <PasswordInput name="password" autoComplete="current-password" invalid={Boolean(state?.errors?.password)} />
      </Field>
      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-[13px] font-medium text-brand-600 hover:underline">Forgot password?</Link>
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Signing in…">Log in</SubmitButton>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(registerAction, null);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next ?? ""} />
      <FormMessage state={state} />
      <Field label="Full name" name="fullName" error={state?.errors?.fullName} help="As you'd like it to appear on certificates.">
        <Input id="fullName" name="fullName" autoComplete="name" required aria-invalid={Boolean(state?.errors?.fullName)} />
      </Field>
      <Field label="Email" name="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required aria-invalid={Boolean(state?.errors?.email)} />
      </Field>
      <Field label="Password" name="password" error={state?.errors?.password} help="At least 10 characters, with a letter and a number.">
        <PasswordInput name="password" autoComplete="new-password" invalid={Boolean(state?.errors?.password)} />
      </Field>
      <div>
        <Checkbox name="acceptTerms" label={<>I agree to the <Link href="/terms" className="font-medium text-brand-600 hover:underline">Terms</Link> and <Link href="/privacy" className="font-medium text-brand-600 hover:underline">Privacy Policy</Link>.</>} />
        {state?.errors?.acceptTerms ? <p className="mt-1.5 text-[12.5px] text-red-600">{state.errors.acceptTerms[0]}</p> : null}
      </div>
      <SubmitButton className="w-full" size="lg" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [state, action] = useActionState<ActionState, FormData>(forgotPasswordAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="Email" name="email" error={state?.errors?.email}>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState<ActionState, FormData>(resetPasswordAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <Field label="New password" name="password" error={state?.errors?.password} help="At least 10 characters, with a letter and a number.">
        <PasswordInput name="password" autoComplete="new-password" />
      </Field>
      <Field label="Confirm password" name="confirm" error={state?.errors?.confirm}>
        <PasswordInput name="confirm" autoComplete="new-password" />
      </Field>
      <SubmitButton className="w-full" size="lg" pendingText="Updating…">Update password</SubmitButton>
    </form>
  );
}
