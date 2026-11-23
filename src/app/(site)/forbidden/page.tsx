import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Access denied", robots: { index: false } };

export default function ForbiddenPage() {
  return (
    <div className="container-page max-w-lg py-24 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-500/10 text-red-400"><ShieldAlert className="size-7" /></span>
      <h1 className="mt-5 text-3xl font-bold">Access denied</h1>
      <p className="mt-2 text-ink-muted">You don&apos;t have permission to view that page. If you think this is a mistake, contact support.</p>
      <ButtonLink href="/dashboard" className="mt-6">Go to your dashboard</ButtonLink>
    </div>
  );
}
