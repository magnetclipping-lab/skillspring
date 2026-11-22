"use client";
import { useTransition } from "react";
import { withdrawApplicationAction } from "@/lib/actions/internships";

export function WithdrawButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="text-sm font-semibold text-red-600 hover:underline disabled:opacity-50"
      onClick={() => { if (confirm("Withdraw this application? This cannot be undone.")) start(async () => { await withdrawApplicationAction(id); }); }}>
      {pending ? "Withdrawing…" : "Withdraw"}
    </button>
  );
}
