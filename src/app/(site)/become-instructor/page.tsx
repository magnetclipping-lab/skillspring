import type { Metadata } from "next";
import { CheckCircle2, ClipboardCheck, IndianRupee, LineChart, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/dal";
import { Alert, Card } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { InstructorApplicationForm } from "./form";

export const metadata: Metadata = { title: "Become an instructor", description: "Teach practical skills to students across India with SkillSpring." };

export default async function BecomeInstructorPage() {
  const user = await getSessionUser();
  return (
    <>
      <section className="hero-gradient text-white">
        <div className="container-page py-16">
          <p className="eyebrow !text-brand-300">Teach with SkillSpring</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-bold text-white">Share what you know. Help students get job-ready.</h1>
          <p className="mt-3 max-w-2xl text-brand-100/90">We partner with practitioners — chartered accountants, analysts, marketers, engineers and recruiters — to build affordable, practical courses.</p>
        </div>
      </section>
      <div className="container-page grid gap-10 py-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <h2 className="text-2xl font-bold">How it works</h2>
          <ol className="space-y-4">
            {[
              { icon: ClipboardCheck, t: "Apply", d: "Tell us about your experience. We review every application." },
              { icon: LineChart, t: "Build your course", d: "Use the instructor portal to create modules, lessons, quizzes and assignments." },
              { icon: ShieldCheck, t: "Review", d: "Our team checks quality and confirms you hold the rights to all material." },
              { icon: IndianRupee, t: "Earn", d: "Receive the agreed revenue share on every verified sale, tracked in your portal." },
            ].map(({ icon: Icon, t, d }) => (
              <li key={t} className="flex gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-5" /></span><div><p className="font-semibold">{t}</p><p className="text-sm text-ink-muted">{d}</p></div></li>
            ))}
          </ol>
          <ul className="space-y-2 text-sm text-ink-soft">
            {["Revenue-share percentages are agreed in writing before publication", "Refunds reverse the corresponding share automatically", "You keep ownership of your original material"].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-emerald-500" />{t}</li>)}
          </ul>
        </div>
        <Card className="p-6">
          <h2 className="text-xl font-bold">Apply to teach</h2>
          <div className="mt-4">
            {!user ? (
              <div className="space-y-4"><p className="text-sm text-ink-muted">Create a free account or log in to apply.</p><div className="flex gap-3"><ButtonLink href="/login?next=/become-instructor">Log in</ButtonLink><ButtonLink href="/register?next=/become-instructor" variant="secondary">Create account</ButtonLink></div></div>
            ) : user.instructor ? (
              <Alert tone="info" title="You've already applied">Status: {user.instructor.status}. <a className="font-semibold underline" href="/dashboard/instructor-application">View application</a></Alert>
            ) : <InstructorApplicationForm defaultName={user.profile.full_name} />}
          </div>
        </Card>
      </div>
    </>
  );
}
