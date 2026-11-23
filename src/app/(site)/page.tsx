import Link from "next/link";
import {
  ArrowRight, ArrowUpRight, Award, BadgeCheck, Check, ClipboardCheck, Download, FileQuestion,
  FolderKanban, Megaphone, PlayCircle, Sparkles, Trophy, Users,
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
  { icon: ClipboardCheck, title: "Project experiences", text: "Apply to Proofwork-run simulations to build your profile." },
];

const steps = [
  { title: "Choose a program", text: "Pick the skill you want and enrol with UPI, card or net banking." },
  { title: "Learn by doing", text: "Watch lessons, practise with the files and pass the quizzes." },
  { title: "Build your projects", text: "Submit assignments and finish a capstone that proves your skill." },
  { title: "Get certified", text: "Earn a verifiable certificate and add it to your CV and LinkedIn." },
];

const facts = ["4 focused programs", "From ₹1,999, one-time", "Verifiable certificates", "100% online, self-paced"];

function SectionHead({ eyebrow, title, accent, text, id, action }: { eyebrow: string; title: string; accent?: string; text?: string; id: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id} className="display mt-4 text-[42px] sm:text-[58px]">
          <span className="text-sheen">{title}</span>
          {accent ? <> <span className="serif-accent text-gold">{accent}</span></> : null}
        </h2>
        {text ? <p className="mt-4 text-[17px] leading-7 text-ink-soft">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default async function HomePage() {
  const [programs, internships] = await Promise.all([getPrograms(), getInternships()]);
  const priceLabel = (p: (typeof programs)[number]) => (p.course ? formatINR(p.course.effective_price) : "");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative pb-20 pt-16 text-center sm:pt-24">
          <Link href="/campus-ambassador" className="group mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 text-[13px] font-medium text-ink-soft transition hover:border-white/20">
            <span className="rounded-full bg-marigold-400 px-2.5 py-0.5 text-[11.5px] font-bold text-canvas">New</span>
            Campus Ambassador program is open
            <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
          </Link>
          <h1 className="display mx-auto mt-8 max-w-5xl text-[52px] sm:text-[84px] xl:text-[104px]">
            <span className="text-sheen">Learn skills.</span>
            <br />
            <span className="text-sheen">Build </span>
            <span className="serif-accent text-gold">proof</span>
            <span className="text-sheen">.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-[17px] leading-8 text-ink-soft sm:text-[19px]">
            Practical programs in the stock market, web development, digital marketing and Excel for college students and fresh graduates across India. Build real projects and earn a certificate employers can verify.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/programs" className="btn-primary">Explore programs <ArrowRight className="size-4" /></Link>
            <Link href="/register" className="btn-ghost">Create free account</Link>
          </div>
          <ul className="mt-9 flex flex-wrap justify-center gap-x-7 gap-y-2 text-[14px] text-ink-muted">
            {["Verifiable certificates", "Hands-on projects", "Secure Razorpay checkout"].map((t) => (
              <li key={t} className="flex items-center gap-2"><Check className="size-4 text-marigold-400" strokeWidth={2.5} />{t}</li>
            ))}
          </ul>

          {/* Product frame */}
          <div className="relative mx-auto mt-16 max-w-5xl text-left">
            <div className="absolute -inset-x-10 -top-10 bottom-10 rounded-[48px] bg-[radial-gradient(closest-side,rgb(108_118_245/0.18),transparent)] blur-2xl" aria-hidden />
            <div className="relative rounded-[32px] border border-white/10 bg-white/[0.02] p-2 shadow-lift">
              <div className="rounded-[26px] border border-white/[0.06] bg-surface p-4 sm:p-6">
                <HeroSwitcher
                  programs={programs.map((p) => ({ slug: p.slug, shortName: p.shortName, pitch: p.pitch, hue: p.hue, showcase: p.showcase, price: priceLabel(p), duration: p.duration }))}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Facts strip */}
      <section aria-label="At a glance" className="border-y border-white/[0.06] bg-surface/50">
        <ul className="container-page grid grid-cols-2 divide-white/[0.06] md:grid-cols-4 md:divide-x">
          {facts.map((f) => (
            <li key={f} className="px-4 py-6 text-center text-[14.5px] font-medium text-ink-soft">{f}</li>
          ))}
        </ul>
      </section>

      {/* Programs */}
      <section className="py-24 sm:py-32" aria-labelledby="programs-heading">
        <div className="container-page">
          <SectionHead
            id="programs-heading"
            eyebrow="Programs"
            title="Choose your"
            accent="path."
            text="Four focused programs. One price each, no subscriptions."
            action={<Link href="/programs" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-soft transition hover:text-ink">Compare programs <ArrowUpRight className="size-4" /></Link>}
          />
          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {programs.map((p) => <ProgramTile key={p.slug} p={p} />)}
          </div>
        </div>
      </section>

      {/* Bento: what's included */}
      <section className="pb-24 sm:pb-32" aria-labelledby="included-heading">
        <div className="container-page">
          <SectionHead id="included-heading" eyebrow="What you get" title="Everything you need to" accent="actually learn it." />
          <div className="mt-14 grid gap-4 lg:grid-cols-3 lg:grid-rows-[auto_auto]">
            <figure className="card relative overflow-hidden p-6 sm:p-8 lg:col-span-2 lg:row-span-2">
              <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-marigold-400/10 blur-3xl" aria-hidden />
              <div className="relative flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl border border-marigold-400/30 bg-marigold-400/10"><BadgeCheck className="size-5 text-marigold-400" /></span>
                <div>
                  <p className="font-display text-[20px] font-semibold">Verifiable certificate</p>
                  <p className="text-[14.5px] text-ink-muted">A unique ID that recruiters can check online.</p>
                </div>
              </div>
              <div className="relative mt-8 rotate-[-1deg] transition duration-500 hover:rotate-0">
                <CertificateView cert={{ certificate_code: "SS-2026-SAMPLE0001", student_name: "Your name here", course_title: "Excel for Finance & Business", issued_at: "2026-11-23", status: "valid" }} />
              </div>
              <figcaption className="relative mt-6 flex items-center gap-2 text-[13.5px] text-ink-muted"><Award className="size-4 text-marigold-400" />Sample certificate. Every real one can be verified on Proofwork.</figcaption>
            </figure>
            {includes.slice(0, 2).map(({ icon: Icon, title, text }) => (
              <div key={title} className="card card-hover p-7">
                <Icon className="size-6 text-marigold-400" strokeWidth={1.6} />
                <p className="mt-6 font-display text-[20px] font-semibold">{title}</p>
                <p className="mt-2 text-[15px] leading-6 text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {includes.slice(2).map(({ icon: Icon, title, text }) => (
              <div key={title} className="card card-hover p-7">
                <Icon className="size-6 text-marigold-400" strokeWidth={1.6} />
                <p className="mt-6 font-display text-[20px] font-semibold">{title}</p>
                <p className="mt-2 text-[15px] leading-6 text-ink-muted">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden border-y border-white/[0.06] bg-surface/60 py-24 sm:py-32" aria-labelledby="how-heading">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgb(240_181_68/0.5),transparent)]" aria-hidden />
        <div className="container-page">
          <SectionHead id="how-heading" eyebrow="How it works" title="Four steps to" accent="proof." />
          <ol className="mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            {steps.map((s, i) => (
              <li key={s.title}>
                <div className="flex items-center gap-4">
                  <span className="serif-accent text-gold text-[56px] leading-none">0{i + 1}</span>
                  {i < steps.length - 1 ? <span className="hairline hidden flex-1 md:block" /> : null}
                </div>
                <p className="mt-6 font-display text-[21px] font-semibold">{s.title}</p>
                <p className="mt-2 max-w-[17rem] text-[15px] leading-6 text-ink-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Campus ambassador */}
      <section className="py-24 sm:py-32" aria-labelledby="ambassador-heading">
        <div className="container-page">
          <div className="noise relative grid overflow-hidden rounded-[36px] border border-marigold-400/20 bg-[linear-gradient(135deg,#17130a_0%,#0e1015_55%)] lg:grid-cols-[1.15fr_1fr]">
            <div className="pointer-events-none absolute -left-32 -top-32 size-[28rem] rounded-full bg-marigold-400/15 blur-3xl" aria-hidden />
            <div className="relative p-8 sm:p-14">
              <p className="inline-flex items-center gap-2 rounded-full border border-marigold-400/30 bg-marigold-400/10 px-3.5 py-1.5 text-[13px] font-semibold text-marigold-300"><Sparkles className="size-4" />Free to join</p>
              <h2 id="ambassador-heading" className="display mt-7 text-[42px] sm:text-[58px]">
                <span className="text-sheen">Lead Proofwork at</span> <span className="serif-accent text-gold">your college.</span>
              </h2>
              <p className="mt-5 max-w-lg text-[17px] leading-7 text-ink-soft">Become a Campus Ambassador. Run sessions, grow a community of learners and build leadership experience that stands out on your CV.</p>
              <Link href="/campus-ambassador" className="btn-gold mt-9">Apply to be an ambassador <ArrowRight className="size-4" /></Link>
            </div>
            <ul className="relative grid content-center gap-3 p-6 sm:grid-cols-2 sm:p-10 lg:grid-cols-1">
              {[
                { icon: Award, t: "Certificate of recognition", d: "For every active ambassador." },
                { icon: Trophy, t: "Rewards for top performers", d: "Program access, letters of recommendation and more." },
                { icon: Users, t: "Leadership experience", d: "Plan events and lead a student community." },
                { icon: Megaphone, t: "Marketing skills", d: "Learn outreach and social media by doing it." },
              ].map(({ icon: Icon, t, d }) => (
                <li key={t} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 backdrop-blur">
                  <Icon className="mt-0.5 size-5 shrink-0 text-marigold-400" />
                  <div><p className="font-semibold">{t}</p><p className="text-[14.5px] text-ink-muted">{d}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Internships */}
      <section className="pb-24 sm:pb-32" aria-labelledby="internships-heading">
        <div className="container-page">
          <SectionHead
            id="internships-heading"
            eyebrow="Experience"
            title="Build experience"
            accent="while you learn."
            text="Project experiences run by Proofwork, plus internships from verified employers. Every listing tells you exactly which one it is."
            action={<Link href="/internships" className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-ink-soft transition hover:text-ink">See all opportunities <ArrowUpRight className="size-4" /></Link>}
          />
          <div className="mt-14 grid gap-5 md:grid-cols-3">
            {internships.slice(0, 3).map((i) => <InternshipCard key={i.id} internship={i} />)}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-24 sm:pb-32" aria-labelledby="faq-heading">
        <div className="container-page grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2 id="faq-heading" className="display mt-4 text-[42px] sm:text-[58px]"><span className="text-sheen">Questions,</span> <span className="serif-accent text-gold">answered.</span></h2>
            <p className="mt-5 text-[16px] text-ink-soft">Something else on your mind? <Link href="/contact" className="font-semibold text-marigold-400 hover:underline">Send us a message</Link>.</p>
          </div>
          <FaqList items={generalFaqs} />
        </div>
      </section>

      {/* Final CTA */}
      <section className="pb-24 sm:pb-32">
        <div className="container-page">
          <div className="relative overflow-hidden rounded-[40px] border border-white/10 bg-surface px-8 py-20 text-center sm:px-14">
            <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
            <div className="grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
            <div className="relative">
              <h2 className="display mx-auto max-w-3xl text-[42px] sm:text-[64px]"><span className="text-sheen">Start with one skill</span> <span className="serif-accent text-gold">this month.</span></h2>
              <p className="mx-auto mt-5 max-w-xl text-[17px] text-ink-soft">Pick a program, learn at your pace and finish with a project you&apos;re proud of.</p>
              <div className="mt-10 flex flex-wrap justify-center gap-3">
                <Link href="/programs" className="btn-gold">Explore programs <ArrowRight className="size-4" /></Link>
                <Link href="/register" className="btn-ghost">Create free account</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
