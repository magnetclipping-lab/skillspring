import type { Metadata } from "next";
import { Mail, MessageSquare } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { Card } from "@/components/ui/primitives";
import { ContactForm } from "./form";

export const metadata: Metadata = { title: "Contact us" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return (
    <div className="container-page grid gap-10 py-14 lg:grid-cols-[1fr_1.4fr]">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="mt-2 text-4xl font-bold">We&apos;re here to help</h1>
        <p className="mt-3 text-ink-muted">Questions about a course, your account, refunds or partnerships — send us a message.</p>
        <div className="mt-8 space-y-4 text-sm">
          <p className="flex items-center gap-3"><Mail className="size-5 text-brand-600" /><a href={`mailto:${publicEnv.supportEmail}`} className="font-medium hover:underline">{publicEnv.supportEmail}</a></p>
          <p className="flex items-center gap-3"><MessageSquare className="size-5 text-brand-600" />We usually reply within two working days.</p>
        </div>
      </div>
      <Card className="p-6"><ContactForm defaultTopic={topic} /></Card>
    </div>
  );
}
