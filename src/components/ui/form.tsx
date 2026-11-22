"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { Button, type ButtonVariant, type ButtonSize } from "./button";
import { Alert } from "./primitives";

export type ActionState = { ok?: boolean; message?: string; errors?: Record<string, string[] | undefined> } | null;

export function SubmitButton({ children, pendingText, variant, size, className, ...props }: ComponentProps<"button"> & { pendingText?: string; variant?: ButtonVariant; size?: ButtonSize }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? (pendingText ?? "Saving…") : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state?.message) return null;
  return <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>;
}
