import type { Metadata } from "next";
import { Building2, GraduationCap, Library } from "lucide-react";
import { Card } from "@/components/ui/primitives";
import { ContactForm } from "../contact/form";

export const metadata: Metadata = { title: "Become a partner", description: "Partner with SkillSpring as an employer, college or content partner." };

export default function PartnersPage() {
  return (
    <div className="container-page py-14">
      <div className="max-w-2xl">
        <p className="eyebrow">Partnerships</p>
        <h1 className="mt-2 text-4xl font-bold">Partner with SkillSpring</h1>
        <p className="mt-3 text-ink-muted">We work with organisations that share our goal of making practical skills accessible to students across India.</p>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {[
          { icon: Building2, t: "Employers", d: "List genuine internships after a quick verification. Review applicants and update statuses from a secure employer account." },
          { icon: GraduationCap, t: "Colleges & universities", d: "Offer SkillSpring courses to your students with group access and progress reporting." },
          { icon: Library, t: "Content partners", d: "License educational content to us under clear, written terms. We never publish material without rights." },
        ].map(({ icon: Icon, t, d }) => (
          <Card key={t} className="p-6"><Icon className="size-6 text-brand-600" /><p className="mt-3 font-semibold">{t}</p><p className="mt-1 text-sm leading-6 text-ink-muted">{d}</p></Card>
        ))}
      </div>
      <Card className="mt-10 max-w-2xl p-6"><h2 className="mb-4 text-xl font-bold">Tell us about your organisation</h2><ContactForm defaultTopic="partner" /></Card>
    </div>
  );
}
