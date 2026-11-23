"use client";
import { useActionState } from "react";
import type { ReactNode } from "react";
import { FormMessage, type ActionState } from "./form";

/** Generic client wrapper so server pages can render stateful forms around any server action. */
export function ActionForm({ action, children, className, compact }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; children: ReactNode; className?: string; compact?: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, null);
  return (
    <form action={formAction} className={className}>
      {compact ? (state?.message ? <p className={`mb-2 text-[12.5px] ${state.ok ? "text-emerald-300" : "text-red-400"}`}>{state.message}</p> : null) : <div className={state?.message ? "mb-3" : ""}><FormMessage state={state} /></div>}
      {state?.errors ? (
        <ul className="mb-3 list-disc pl-5 text-[12.5px] text-red-400">
          {Object.entries(state.errors).map(([k, v]) => (v?.length ? <li key={k}><strong>{k.replace(/_/g, " ")}</strong>: {v[0]}</li> : null))}
        </ul>
      ) : null}
      {children}
    </form>
  );
}
