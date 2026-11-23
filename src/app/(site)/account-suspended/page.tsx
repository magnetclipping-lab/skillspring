import type { Metadata } from "next";
import { Ban } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Account suspended", robots: { index: false } };

export default function SuspendedPage() {
  return (
    <div className="container-page max-w-lg py-24 text-center">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600"><Ban className="size-7" /></span>
      <h1 className="mt-5 text-3xl font-bold">Your account is suspended</h1>
      <p className="mt-2 text-ink-muted">Access to learning and applications is paused. Please contact support to resolve this.</p>
      <ButtonLink href="/contact?topic=support" className="mt-6">Contact support</ButtonLink>
    </div>
  );
}
