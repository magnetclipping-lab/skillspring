import type { Metadata } from "next";
import { Compass, HeartHandshake, Scale } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="container-page py-14">
      <div className="max-w-3xl">
        <p className="eyebrow">About SkillSpring</p>
        <h1 className="mt-2 text-4xl font-bold">Practical skills for every student</h1>
        <p className="mt-4 text-lg leading-8 text-ink-soft">SkillSpring is an Indian education platform helping college students and fresh graduates learn job-relevant skills — from finance and stock markets to AI, marketing and career development — at prices students can afford.</p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {[
          { icon: Compass, t: "Our mission", d: "Close the gap between what students learn in class and what workplaces expect, through hands-on, affordable courses." },
          { icon: Scale, t: "Our principles", d: "Honesty first: no fake reviews, no inflated numbers, no placement guarantees, and only content we have the rights to teach." },
          { icon: HeartHandshake, t: "Who we work with", d: "Experienced practitioners as instructors, verified employers for internships, and institutions that share our goals." },
        ].map(({ icon: Icon, t, d }) => (
          <div key={t} className="rounded-2xl border border-line bg-white p-6"><Icon className="size-6 text-brand-600" /><p className="mt-3 font-semibold">{t}</p><p className="mt-1 text-sm leading-6 text-ink-muted">{d}</p></div>
        ))}
      </div>
      <div className="mt-12 flex flex-wrap gap-3"><ButtonLink href="/courses">Explore courses</ButtonLink><ButtonLink href="/contact" variant="secondary">Contact us</ButtonLink></div>
    </div>
  );
}
