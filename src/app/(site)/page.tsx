import Link from "next/link";
import {
  ArrowRight, Award, BadgeCheck, BookOpenCheck, Check, ClipboardCheck, Download, FileQuestion,
  FolderKanban, Gift, Megaphone, PlayCircle, Trophy, Users,
} from "lucide-react";
import { HeroSwitcher } from "@/components/programs/hero-switcher";
import { InternshipCard } from "@/components/site/cards";
import { FaqList, generalFaqs } from "@/components/site/faq-list";
import { CertificateView } from "@/components/certificate";
import { getInternships, getPrograms } from "@/lib/data/catalogue";
import { ProgramTile } from "@/components/programs/program-tile";
import { formatINR } from "@/lib/utils";

const includes = [
  { icon: PlayCircle, title: "Video lessons", text: "Short, focused lessons you can watch at your own pace, on phone or laptop." },
  { icon: Download, title: "Practice files", text: "Workbooks, templates and notes to download for every module." },
  { icon: FileQuestion, title: "Quizzes", text: "Check your understanding at the end of each module." },
  { icon: FolderKanban, title: "Real projects", text: "Graded assignments and a capstone you can show in interviews." },
  { icon: BadgeCheck, title: "Verifiable certificate", text: "A unique certificate ID that recruiters can check online." },
  { icon: ClipboardCheck, title: "Project experiences", text: "Apply to SkillSpring-run simulations to build your profile." },
];

const steps = [
  { title: "Choose a program", text: "Pick the skill you want and enrol with UPI, card or net banking." },
  { title: "Learn by doing", text: "Watch lessons, practise with the files and pass the quizzes." },
  { title: "Build your projects", text: "Submit assignments and finish a capstone that proves your skill." },
  { title: "Get certified", text: "Earn a verifiable certificate and add it to your CV and LinkedIn." },
];

export default async function HomePage() {
  const [programs, internships] = await Promise.all([getPrograms(), getInternships()]);
  const priceLabel = (p: (typeof programs)[number]) => (p.course ? formatINR(p.course.effective_price) : "");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container-page grid items-center gap-12 pb-16 pt-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:pb-24 lg:pt-20">
          <div>
            <p className="text-[15px] font-medium text-ink-soft">For college students and fresh graduates across India</p>
            <h1 className="display mt-5 text-[50px] text-ink sm:text-[76px] xl:text-[92px]">
              Learn skills.
              <br />
              Build experience.
              <br />
              Shape your future.
            </h1>
            <p className="mt-7 max-w-[34rem] text-[18px] leading-8 text-ink-soft">
              Practical programs in the stock market, web development, digital marketing and Excel. Learn at your pace, build real projects and earn a certificate employers can verify.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/programs" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-white transition-colors hover:bg-brand-800">
                Explore programs <ArrowRight className="size-4" />
              </Link>
              <Link href="/campus-ambassador" className="inline-flex h-12 items-center gap-2.5 rounded-full bg-white px-6 text-[15px] font-semibold text-ink ring-1 ring-ink/12 transition-colors hover:ring-ink/30">
                Become a campus ambassador
                <span className="rounded-full bg-marigold-400 px-2 py-0.5 text-[12px] font-bold text-ink">Free</span>
              </Link>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-soft">
              {["Verifiable certificates", "Hands-on projects", "Secure Razorpay checkout"].map((t) => (
                <li key={t} className="flex items-center gap-2"><Check className="size-4 text-stock" strokeWidth={2.5} />{t}</li>
              ))}
            </ul>
          </div>
          <HeroSwitcher
            programs={programs.map((p) => ({ slug: p.slug, shortName: p.shortName, pitch: p.pitch, hue: p.hue, showcase: p.showcase, price: priceLabel(p), duration: p.duration }))}
          />
        </div>
      </section>

      {/* Programs */}
      <section className="bg-white py-20 sm:py-24" aria-labelledby="programs-heading">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="programs-heading" className="display text-[44px] sm:text-[56px]">Choose your program</h2>
              <p className="mt-3 max-w-xl text-[17px] text-ink-soft">Four focused programs. One price each, no subscriptions.</p>
            </div>
            <Link href="/programs" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-600 hover:text-brand-800">Compare programs <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {programs.map((p) => <ProgramTile key={p.slug} p={p} />)}
          </div>
        </div>
      </section>

      {/* Included + certificate */}
      <section className="py-20 sm:py-24" aria-labelledby="included-heading">
        <div className="container-page grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div>
            <h2 id="included-heading" className="display text-[44px] sm:text-[52px]">Everything you need to actually learn it</h2>
            <ul className="mt-10 divide-y divide-ink/8 border-y border-ink/8">
              {includes.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-5 py-5">
                  <Icon className="mt-0.5 size-6 shrink-0 text-brand-600" strokeWidth={1.75} />
                  <div><p className="font-semibold text-ink">{title}</p><p className="mt-0.5 text-[15px] leading-6 text-ink-muted">{text}</p></div>
                </li>
              ))}
            </ul>
          </div>
          <figure>
            <div className="rotate-[-1.5deg] rounded-[26px] bg-white p-3 shadow-[0_40px_80px_-40px_rgb(20_22_58/0.35)] ring-1 ring-ink/8">
              <CertificateView cert={{ certificate_code: "SS-2026-SAMPLE0001", student_name: "Your name here", course_title: "Excel for Finance & Business", issued_at: "2026-11-23", status: "valid" }} />
            </div>
            <figcaption className="mt-6 flex items-center gap-2 text-[14px] text-ink-muted"><Award className="size-4 text-marigold-600" />Sample certificate. Every real one has a unique ID that anyone can verify on SkillSpring.</figcaption>
          </figure>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-ink py-20 text-white sm:py-24" aria-labelledby="how-heading">
        <div className="container-page">
          <h2 id="how-heading" className="display text-[44px] text-white sm:text-[52px]">How it works</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
            {steps.map((s, i) => (
              <li key={s.title} className="relative">
                <div className="flex items-center gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-marigold-400 font-display text-[18px] font-bold text-ink">{i + 1}</span>
                  {i < steps.length - 1 ? <span className="hidden h-px flex-1 bg-white/20 md:block" /> : null}
                </div>
                <p className="mt-6 font-display text-[22px] font-semibold text-white">{s.title}</p>
                <p className="mt-2 max-w-[17rem] text-[15px] leading-6 text-white/65">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Campus ambassador */}
      <section className="py-20 sm:py-24" aria-labelledby="ambassador-heading">
        <div className="container-page">
          <div className="grid overflow-hidden rounded-[36px] bg-marigold-400 lg:grid-cols-[1.2fr_1fr]">
            <div className="p-8 sm:p-14">
              <p className="inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-marigold-300"><Gift className="size-4" />Free to join</p>
              <h2 id="ambassador-heading" className="display mt-6 text-[44px] text-ink sm:text-[56px]">Lead SkillSpring at your college</h2>
              <p className="mt-4 max-w-lg text-[17px] leading-7 text-ink/80">Become a Campus Ambassador. Run sessions, grow a community of learners and build leadership experience that stands out on your CV.</p>
              <Link href="/campus-ambassador" className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-semibold text-white hover:bg-brand-800">Apply to be an ambassador <ArrowRight className="size-4" /></Link>
            </div>
            <ul className="grid content-center gap-px bg-ink/10 sm:grid-cols-2 lg:grid-cols-1">
              {[
                { icon: Award, t: "Certificate of recognition", d: "For every active ambassador." },
                { icon: Trophy, t: "Rewards for top performers", d: "Program access, letters of recommendation and more." },
                { icon: Users, t: "Leadership experience", d: "Plan events and lead a student community." },
                { icon: Megaphone, t: "Marketing skills", d: "Learn outreach and social media by doing it." },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-4 bg-marigold-300/60 px-8 py-6">
                  <Icon className="mt-0.5 size-5 shrink-0 text-ink" />
                  <div><p className="font-semibold text-ink">{t}</p><p className="text-[14.5px] text-ink/70">{d}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Internships */}
      <section className="bg-white py-20 sm:py-24" aria-labelledby="internships-heading">
        <div className="container-page">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="internships-heading" className="display text-[44px] sm:text-[52px]">Build experience while you learn</h2>
              <p className="mt-3 max-w-2xl text-[17px] text-ink-soft">Project experiences run by SkillSpring, plus internships from verified employers. Every listing tells you exactly which one it is.</p>
            </div>
            <Link href="/internships" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-brand-600 hover:text-brand-800">See all opportunities <ArrowRight className="size-4" /></Link>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {internships.slice(0, 3).map((i) => <InternshipCard key={i.id} internship={i} />)}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 sm:py-24" aria-labelledby="faq-heading">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <h2 id="faq-heading" className="display text-[44px] sm:text-[52px]">Questions</h2>
            <p className="mt-4 text-[16px] text-ink-soft">Something else on your mind? <Link href="/contact" className="font-semibold text-brand-600 hover:underline">Send us a message</Link>.</p>
          </div>
          <FaqList items={generalFaqs} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-20 sm:pb-24">
        <div className="container-page">
          <div className="flex flex-col items-start justify-between gap-8 rounded-[36px] bg-ink px-8 py-14 sm:px-14 lg:flex-row lg:items-center">
            <div>
              <h2 className="display text-[40px] text-white sm:text-[52px]">Start with one skill this month</h2>
              <p className="mt-3 text-[17px] text-white/70">Pick a program, learn at your pace and finish with a project you&apos;re proud of.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/programs" className="inline-flex h-12 items-center gap-2 rounded-full bg-marigold-400 px-6 text-[15px] font-semibold text-ink hover:bg-marigold-300"><BookOpenCheck className="size-4" />Explore programs</Link>
              <Link href="/register" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-white ring-1 ring-white/30 hover:bg-white/10">Create free account</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
