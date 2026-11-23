import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Verify a certificate", description: "Check that a Proofwork certificate is genuine." };

async function lookup(fd: FormData) {
  "use server";
  const code = String(fd.get("code") ?? "").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 40);
  if (code) redirect(`/verify/${code}`);
}

export default function VerifyPage() {
  return (
    <div className="container-page max-w-xl py-16 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-500/10 text-brand-300"><BadgeCheck className="size-7" /></span>
      <h1 className="mt-5 text-3xl font-bold">Verify a certificate</h1>
      <p className="mt-2 text-ink-muted">Enter the certificate ID printed on a Proofwork certificate (for example SS-2026-1A2B3C4D5E).</p>
      <form action={lookup} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <label className="flex-1"><span className="sr-only">Certificate ID</span><Input name="code" required placeholder="SS-YYYY-XXXXXXXXXX" className="h-12 font-mono uppercase" maxLength={40} /></label>
        <Button type="submit" size="lg">Verify</Button>
      </form>
    </div>
  );
}
