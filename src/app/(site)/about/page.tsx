import type { Metadata } from "next";
import { Compass, HeartHandshake, Scale } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="container-page py-14">
      <div className="max-w-3xl">
        <p className="eyebrow">About Proofwork</p>
        <h1 className="display mt-4 text-[44px] sm:text-[56px]">Skills you practise, not just watch</h1>
        <p className="mt-4 text-lg leading-8 text-ink-soft">Proofwork is an Indian learning platform for professionals, founders and students. We teach practical skills in AI and automation, digital marketing, professional tools such as Excel and Power BI, and business fundamentals — and every course is built around assignments you complete and get evaluated on.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {[
          { icon: Compass, t: "Our mission", d: "Help people get genuinely good at the tools and methods modern work runs on, through practice and honest feedback." },
          { icon: Scale, t: "Our principles", d: "Honesty first: no fake reviews, no inflated numbers, no placement guarantees, and only content we have the rights to teach." },
          { icon: HeartHandshake, t: "Who we work with", d: "Practitioners who build and teach the courses, and learners who want feedback on real work rather than a badge." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-xl border border-line bg-surface p-6"><Icon className="size-6 text-violet-300" /><p className="mt-3 font-semibold">{t}</p><p className="mt-1 text-sm leading-6 text-ink-muted">{d}</p></div>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap gap-3"><ButtonLink href="/courses">Browse courses</ButtonLink><ButtonLink href="/contact" variant="secondary">Contact us</ButtonLink></div>
    </div>
  );
}
