import type { Metadata } from "next";
import { Award, CalendarCheck, FileBadge, Gift, Megaphone, Rocket, Sparkles, Trophy, Users } from "lucide-react";
import { FaqList } from "@/components/site/faq-list";
import { getSessionUser } from "@/lib/auth/dal";
import { AmbassadorForm } from "./form";

export const metadata: Metadata = {
  title: "Campus Ambassador Program",
  description: "Join the SkillSpring Campus Ambassador Program for free. Lead at your college, build leadership and marketing experience, and earn a certificate.",
  alternates: { canonical: "/campus-ambassador" },
};

const perks = [
  { icon: FileBadge, title: "Certificate of recognition", text: "Every active ambassador who completes the term gets a SkillSpring certificate." },
  { icon: Trophy, title: "Rewards for top performers", text: "Free program access, letters of recommendation and features on our channels." },
  { icon: Users, title: "Leadership experience", text: "Plan sessions, run a student community and work with a team." },
  { icon: Megaphone, title: "Real marketing skills", text: "Learn outreach, social media and event promotion by doing it." },
  { icon: Sparkles, title: "Early access", text: "Try new programs and features before they launch, and tell us what to improve." },
  { icon: Rocket, title: "A stronger CV", text: "Concrete responsibilities and results you can talk about in interviews." },
];

const duties = [
  "Share SkillSpring programs and opportunities with students at your college",
  "Help organise a workshop, webinar or info session on campus",
  "Grow and look after a small community of learners",
  "Share honest feedback from students with our team",
];

const steps = [
  { icon: CalendarCheck, title: "Apply free", text: "Fill in the short form below. It takes about three minutes." },
  { icon: Users, title: "Quick chat", text: "Shortlisted students get a short call with our team." },
  { icon: Gift, title: "Get onboarded", text: "Receive your ambassador kit, referral code and monthly goals." },
  { icon: Award, title: "Lead and earn", text: "Run activities, track your impact and earn recognition." },
];

const faqs = [
  { q: "Is it really free to join?", a: "Yes. There is no fee to apply or to be a Campus Ambassador, and there never will be. If anyone asks you to pay to join, it isn't us." },
  { q: "Who can apply?", a: "Any student currently enrolled in a college or university in India, in any stream or year. You don't need to be a SkillSpring learner to apply." },
  { q: "How much time does it take?", a: "Plan for about 3 to 5 hours a week. You can fit it around classes and exams, and we keep activity goals realistic." },
  { q: "Is this a paid role?", a: "It's a volunteer leadership program, not a job. Top performers receive rewards such as free program access and letters of recommendation, but there's no fixed stipend." },
  { q: "Will I get a certificate?", a: "Yes. Ambassadors who stay active through their term receive a SkillSpring Campus Ambassador certificate." },
  { q: "Can more than one student from a college join?", a: "Yes. Larger colleges can have a small team of ambassadors who work together." },
  { q: "How will I hear back?", a: "We review applications every week. If you're shortlisted, we'll contact you by email or phone using the details you share." },
];

export default async function CampusAmbassadorPage() {
  const user = await getSessionUser();
  return (
    <>
      {/* Hero */}
      <section className="bg-marigold-400">
        <div className="container-page grid gap-12 pb-20 pt-14 lg:grid-cols-[1.25fr_1fr] lg:items-end lg:pb-24 lg:pt-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-marigold-300"><Gift className="size-4" />Free to join</p>
            <h1 className="display mt-7 text-[56px] text-ink sm:text-[84px]">Campus Ambassador Program</h1>
            <p className="mt-6 max-w-xl text-[18px] leading-8 text-ink/80">
              Be the face of SkillSpring at your college. Help classmates find practical skills, lead events and build experience that sets your CV apart.
            </p>
            <a href="#apply" className="mt-9 inline-flex h-12 items-center rounded-full bg-ink px-7 text-[15px] font-semibold text-white hover:bg-brand-800">Apply now, it&apos;s free</a>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[28px] bg-ink/15">
            {[
              ["Cost to join", "₹0"],
              ["Time each week", "3–5 hrs"],
              ["Open to", "All streams"],
              ["Work from", "Your campus"],
            ].map(([k, v]) => (
              <div key={k} className="bg-marigold-300/70 p-6">
                <dt className="text-[13.5px] font-medium text-ink/70">{k}</dt>
                <dd className="mt-1 font-display text-[28px] font-bold tracking-tight text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Perks */}
      <section className="py-20 sm:py-24" aria-labelledby="perks-heading">
        <div className="container-page">
          <h2 id="perks-heading" className="display max-w-2xl text-[44px] sm:text-[52px]">What you get</h2>
          <ul className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {perks.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="grid size-12 place-items-center rounded-2xl bg-marigold-100"><Icon className="size-6 text-marigold-600" /></span>
                <p className="mt-5 font-display text-[21px] font-semibold text-ink">{title}</p>
                <p className="mt-2 text-[15.5px] leading-7 text-ink-soft">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Role + steps */}
      <section className="bg-ink py-20 text-white sm:py-24">
        <div className="container-page grid gap-16 lg:grid-cols-2">
          <div>
            <h2 className="display text-[40px] text-white sm:text-[48px]">What you&apos;ll do</h2>
            <ul className="mt-10 space-y-5">
              {duties.map((d) => (
                <li key={d} className="flex gap-4 text-[17px] leading-7 text-white/85"><span className="mt-3 h-px w-6 shrink-0 bg-marigold-400" />{d}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="display text-[40px] text-white sm:text-[48px]">How it works</h2>
            <ol className="mt-10 space-y-7">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marigold-400 font-display text-[18px] font-bold text-ink">{i + 1}</span>
                  <div><p className="font-display text-[20px] font-semibold text-white">{s.title}</p><p className="mt-1 text-[15px] text-white/65">{s.text}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Apply */}
      <section id="apply" className="scroll-mt-20 py-20 sm:py-24" aria-labelledby="apply-heading">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 id="apply-heading" className="display text-[44px] sm:text-[52px]">Apply to be an ambassador</h2>
            <p className="mt-4 max-w-md text-[17px] leading-7 text-ink-soft">No fee, no catch. Tell us a bit about yourself and your college, and we&apos;ll get back to you within a week.</p>
          </div>
          <div className="rounded-[28px] bg-white p-6 shadow-[0_30px_70px_-45px_rgb(20_22_58/0.45)] ring-1 ring-ink/8 sm:p-9">
            <AmbassadorForm defaultName={user?.profile.full_name ?? undefined} defaultEmail={user?.email ?? undefined} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white py-20 sm:py-24" aria-labelledby="amb-faq">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <h2 id="amb-faq" className="display text-[44px] sm:text-[52px]">Questions</h2>
          <FaqList items={faqs} />
        </div>
      </section>
    </>
  );
}
