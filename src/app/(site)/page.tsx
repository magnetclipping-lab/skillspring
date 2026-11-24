import Link from "next/link";
import { ArrowRight, Check, FileSpreadsheet, FileText, ListChecks, Hammer, Compass, Clock3, Bot, UserCheck, Bell } from "lucide-react";
import { FaqList, generalFaqs } from "@/components/site/faq-list";
import { CourseCard, CourseFeature } from "@/components/courses/course-card";
import { accentDot, accentText } from "@/components/courses/accent";
import { getCategories, getFeaturedCourses, getPublicInstructors, getPublishedCourses, getTestimonials } from "@/lib/data/catalogue";
import { cn } from "@/lib/utils";

const FORMATS = [
  { icon: ListChecks, name: "Interactive quizzes", text: "Multiple choice, multi-select, true/false, matching, fill-in-the-blank and scenario questions. Marked instantly with explanations." },
  { icon: FileSpreadsheet, name: "Workbook assignments", text: "Download an Excel workbook with real data, solve the tasks with live formulas and upload it. Formulas and values are both checked." },
  { icon: FileText, name: "Written assignments", text: "Answer case questions in a Word brief. Graded against a rubric and an answer key of the points a strong answer covers." },
  { icon: Hammer, name: "Practical projects", text: "Do the work for real — a campaign, an automation, a dashboard — and submit evidence: files, links and screenshots." },
  { icon: Compass, name: "Scenario challenges", text: "A realistic problem lands on your desk. Diagnose it, decide what to do and explain the trade-offs." },
];

const STEPS = [
  { t: "Learn the method", d: "Short, focused lessons per module, with the reasoning behind each technique." },
  { t: "Practise on real material", d: "Workbooks with real data, briefs from realistic businesses, tools you'll use at work." },
  { t: "Submit your work", d: "Upload files, add links or write your answer. Every version is kept." },
  { t: "Get evaluated", d: "Marked against a published rubric with criterion-by-criterion feedback." },
  { t: "Improve and resubmit", d: "Act on the feedback, resubmit, and track your progress over time." },
];

const WHY = [
  { t: "Work, not just watching", d: "Every course has four graded assignments and a quiz. You finish with things you made, not a playlist you watched." },
  { t: "Feedback you can act on", d: "Each submission is scored per rubric criterion with specific comments. A person can review any result." },
  { t: "One clear price", d: "₹7,500 per course. No subscription, no upsells inside the course, refund within 7 days under 25% progress." },
  { t: "Skills used at work today", d: "AI assistants and agents, performance marketing, Excel and Power BI, financial modelling, sales and launch fundamentals." },
];

const OUTCOMES = [
  "A body of graded work: workbooks, written analyses and practical projects you can show",
  "Criterion-by-criterion feedback and a history of every submission and resubmission",
  "Fluency with the tools in your course — Claude, ChatGPT, Gemini, Google & Meta Ads, Excel, Power BI and more",
  "An internal Proofwork completion record when you finish (not an accredited qualification)",
];

function SectionHead({ id, kicker, title, text, action }: { id: string; kicker: string; title: React.ReactNode; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        <p className="eyebrow">{kicker}</p>
        <h2 id={id} className="display mt-4 text-[38px] text-ink sm:text-[52px]">{title}</h2>
        {text ? <p className="mt-4 text-[17px] leading-7 text-ink-soft">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Illustrative product view: how an evaluated assignment looks in the dashboard. */
function EvaluationSnapshot() {
  const rows = [
    { c: "Accuracy of results", s: 34, m: 40 },
    { c: "Live, correct formulas", s: 21, m: 25 },
    { c: "Structure and presentation", s: 12, m: 15 },
    { c: "Insight and recommendation", s: 13, m: 20 },
  ];
  return (
    <figure className="relative rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <p className="text-[13px] font-medium text-ink-soft">Workbook assignment · Campaign performance analysis</p>
        <span className="rounded bg-cyan-tint px-2 py-0.5 text-[11.5px] font-semibold text-cyan-300">Evaluated</span>
      </div>
      <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr]">
        <div>
          <p className="font-display text-[56px] font-semibold leading-none">80<span className="text-2xl text-ink-muted">/100</span></p>
          <p className="mt-2 text-[12.5px] text-ink-muted">Pass mark 50 · Version 2</p>
        </div>
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.c}>
              <div className="flex justify-between text-[12.5px]"><span className="text-ink-soft">{r.c}</span><span className="font-mono text-ink-muted">{r.s}/{r.m}</span></div>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(r.s / r.m) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-line px-5 py-4 text-[13.5px] leading-6 text-ink-soft">
        <span className="font-semibold text-ink">Feedback · </span>CPA by channel is correct and formulas are live. Your budget shift ignores the email list&apos;s capacity — say how many extra conversions it can realistically take.
      </div>
      <ol className="flex flex-wrap gap-x-5 gap-y-2 border-t border-line px-5 py-3.5 text-[12px] text-ink-muted">
        {["Submitted 10:02", "Pending evaluation", "Evaluated 11:04", "Notified"].map((s, i) => (
          <li key={s} className="flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", i < 3 ? "bg-cyan-400" : "bg-violet-400")} />{s}</li>
        ))}
      </ol>
      <figcaption className="sr-only">Example of an evaluated assignment in the Proofwork dashboard.</figcaption>
    </figure>
  );
}

export default async function HomePage() {
  const [featured, all, categories, instructors, testimonials] = await Promise.all([
    getFeaturedCourses(4), getPublishedCourses(), getCategories(), getPublicInstructors(), getTestimonials(),
  ]);
  const [lead, ...rest] = featured;

  return (
    <main id="main">
      {/* Hero */}
      <section className="hero-glow relative overflow-hidden border-b border-line" aria-labelledby="hero">
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative grid gap-14 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-28 lg:pt-24">
          <div className="animate-fade-up">
            <p className="eyebrow">{all.length} courses · ₹7,500 each</p>
            <h1 id="hero" className="display mt-6 text-[52px] text-ink sm:text-[76px] lg:text-[84px]">
              Build skills that <span className="serif-accent text-violet-300">move you</span> forward.
            </h1>
            <p className="mt-6 max-w-xl text-[18px] leading-8 text-ink-soft">
              Practical courses in AI, digital marketing, professional tools and business. Learn a method, apply it to real material, and get every assignment evaluated against a clear rubric.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/courses" className="btn-primary">Browse courses <ArrowRight className="size-4" /></Link>
              <Link href="#assignments" className="btn-ghost">How assignments work</Link>
            </div>
            <dl className="mt-12 grid max-w-xl grid-cols-3 border-t border-line pt-6">
              {[["4", "assignment formats per course"], ["~60 min", "typical evaluation time"], ["Lifetime", "access to what you buy"]].map(([k, v]) => (
                <div key={v}><dt className="sr-only">{v}</dt><dd className="font-display text-2xl font-semibold">{k}</dd><p className="mt-1 text-[12.5px] leading-5 text-ink-muted">{v}</p></div>
              ))}
            </dl>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <EvaluationSnapshot />
            <p className="mt-3 text-[12px] text-ink-muted">Illustration of an evaluated submission in the learner dashboard.</p>
          </div>
        </div>
      </section>

      {/* Featured */}
      {lead ? (
        <section className="container-page py-24" aria-labelledby="featured">
          <SectionHead id="featured" kicker="Featured courses" title="Start with one of these" text="Each course has a 30-second preview, a full curriculum and the exact assignments you'll complete." action={<Link href="/courses" className="btn-ghost h-11">All courses <ArrowRight className="size-4" /></Link>} />
          <div className="mt-12 space-y-6">
            <CourseFeature c={lead} />
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{rest.map((c) => <CourseCard key={c.id} c={c} />)}</div>
          </div>
        </section>
      ) : null}

      {/* Categories */}
      <section className="border-y border-line bg-surface/40" aria-labelledby="categories">
        <div className="container-page py-24">
          <SectionHead id="categories" kicker="Categories" title="Four areas. One standard of work." />
          <div className="mt-12 grid border-t border-line md:grid-cols-2 lg:grid-cols-4">
            {categories.map((cat, i) => {
              const list = all.filter((c) => c.category?.slug === cat.slug);
              return (
                <div key={cat.slug} className={cn("flex flex-col border-b border-line py-8 md:px-6", i % 2 === 1 && "md:border-l", i > 0 && "lg:border-l", i === 0 && "md:pl-0")}>
                  <p className="font-mono text-[12px] text-ink-muted">{String(i + 1).padStart(2, "0")} · {list.length} courses</p>
                  <h3 className="mt-3 flex items-center gap-2 font-display text-xl font-semibold"><span className={cn("size-2 rounded-full", accentDot(cat.accent))} />{cat.name}</h3>
                  {cat.tagline ? <p className="mt-2 text-[14px] leading-6 text-ink-muted">{cat.tagline}</p> : null}
                  <ul className="mt-5 space-y-2">
                    {list.slice(0, 4).map((c) => (
                      <li key={c.slug}><Link href={`/courses/${c.slug}`} className="text-[14px] text-ink-soft transition hover:text-ink">{c.title.split(" — ")[0]}</Link></li>
                    ))}
                  </ul>
                  <Link href={`/courses?category=${cat.slug}`} className={cn("mt-6 text-[13.5px] font-semibold", accentText(cat.accent))}>View all {list.length} →</Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="container-page py-24" aria-labelledby="why">
        <SectionHead id="why" kicker="Why Proofwork" title={<>Learning that ends in <span className="serif-accent text-violet-300">finished work</span></>} />
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {WHY.map((w) => (
            <div key={w.t} className="bg-canvas p-8">
              <h3 className="font-display text-xl font-semibold">{w.t}</h3>
              <p className="mt-3 text-[15px] leading-7 text-ink-soft">{w.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Method */}
      <section id="method" className="scroll-mt-20 border-y border-line bg-surface/40" aria-labelledby="method-h">
        <div className="container-page py-24">
          <SectionHead id="method-h" kicker="Methodology" title="Learn, practise, prove, improve" text="Every module follows the same loop, so you always know what's expected and how it's judged." />
          <ol className="mt-14 grid gap-10 md:grid-cols-5 md:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.t} className="relative">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[13px] text-violet-300">{String(i + 1).padStart(2, "0")}</span>
                  <span className="h-px flex-1 bg-line" aria-hidden />
                </div>
                <h3 className="mt-4 font-display text-[17px] font-semibold">{s.t}</h3>
                <p className="mt-2 text-[14px] leading-6 text-ink-muted">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Assignments */}
      <section id="assignments" className="container-page scroll-mt-20 py-24" aria-labelledby="assignments-h">
        <SectionHead id="assignments-h" kicker="Assignment system" title="Five formats, one clear rubric" text="Different skills need different proof. Each course mixes these formats, and every one is marked against criteria you can read before you start." />
        <div className="mt-12 grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <ul className="divide-y divide-line border-y border-line">
            {FORMATS.map((f) => (
              <li key={f.name} className="grid grid-cols-[36px_1fr] gap-4 py-6">
                <f.icon className="mt-0.5 size-5 text-cyan-400" aria-hidden />
                <div>
                  <h3 className="font-display text-[17px] font-semibold">{f.name}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-6 text-ink-muted">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-line bg-surface p-7">
            <p className="kicker">After you submit</p>
            <ol className="mt-6 space-y-6">
              {[
                { icon: Check, t: "Stored and versioned", d: "Your file, links or text are saved. Resubmitting creates a new version; history is kept." },
                { icon: Clock3, t: "Pending evaluation", d: "Evaluation is queued for about an hour later, so you can still fix a mistake." },
                { icon: Bot, t: "Evaluated against the rubric", d: "Workbooks are read for formulas and values; documents for their content. Scored per criterion against the answer key." },
                { icon: UserCheck, t: "Human review when needed", d: "Low-confidence or unusual results are flagged for a person, who can adjust any mark." },
                { icon: Bell, t: "Results in your dashboard", d: "Marks, feedback and a notification as soon as it's done." },
              ].map((s) => (
                <li key={s.t} className="grid grid-cols-[28px_1fr] gap-3">
                  <s.icon className="mt-0.5 size-4 text-violet-300" aria-hidden />
                  <div><p className="text-[15px] font-semibold">{s.t}</p><p className="mt-1 text-[13.5px] leading-6 text-ink-muted">{s.d}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Outcomes */}
      <section className="border-y border-line bg-surface/40" aria-labelledby="outcomes">
        <div className="container-page grid gap-12 py-24 lg:grid-cols-[1fr_1.2fr]">
          <SectionHead id="outcomes" kicker="Outcomes" title="What you leave with" text="We don't promise jobs or placements. We promise practice, honest feedback and work you can show." />
          <ul className="divide-y divide-line border-y border-line">
            {OUTCOMES.map((o) => (
              <li key={o} className="flex gap-4 py-5 text-[16px] leading-7 text-ink-soft"><Check className="mt-1.5 size-4 shrink-0 text-cyan-400" aria-hidden />{o}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Instructors — shown only when real instructor profiles are published */}
      {instructors.length ? (
        <section className="container-page py-24" aria-labelledby="instructors">
          <SectionHead id="instructors" kicker="Instructors" title="Who teaches" />
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {instructors.map((p) => (
              <div key={p.id} className="rounded-xl border border-line bg-surface p-6">
                <p className="font-display text-lg font-semibold">{p.display_name}</p>
                {p.headline ? <p className="mt-1 text-[14px] text-violet-300">{p.headline}</p> : null}
                {p.bio ? <p className="mt-3 line-clamp-4 text-[14px] leading-6 text-ink-muted">{p.bio}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* Testimonials — real, published learner reviews only */}
      {testimonials.length ? (
        <section className="container-page py-24" aria-labelledby="testimonials">
          <SectionHead id="testimonials" kicker="From learners" title="In their words" text="Published reviews from learners enrolled in the course." />
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.id} className="flex flex-col rounded-xl border border-line bg-surface p-6">
                <blockquote className="flex-1 text-[15px] leading-7 text-ink-soft">“{t.comment}”</blockquote>
                <figcaption className="mt-5 text-[13px] text-ink-muted">Verified learner{t.course ? <> · <Link className="hover:text-ink" href={`/courses/${t.course.slug}`}>{t.course.title.split(" — ")[0]}</Link></> : null}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* FAQ */}
      <section className="container-page grid gap-12 py-24 lg:grid-cols-[1fr_1.6fr]" aria-labelledby="faq">
        <SectionHead id="faq" kicker="FAQ" title="Questions, answered" action={null} />
        <FaqList items={generalFaqs} />
      </section>

      {/* CTA */}
      <section className="border-t border-line" aria-labelledby="cta">
        <div className="container-page flex flex-col items-start justify-between gap-8 py-20 md:flex-row md:items-center">
          <div>
            <h2 id="cta" className="display text-[40px] sm:text-[56px]">Pick a skill. <span className="serif-accent text-violet-300">Do the work.</span></h2>
            <p className="mt-3 text-[16px] text-ink-soft">{all.length} courses across {categories.length} categories · ₹7,500 per course · Refund within 7 days under 25% progress.</p>
          </div>
          <Link href="/courses" className="btn-primary">Browse all courses <ArrowRight className="size-4" /></Link>
        </div>
      </section>
    </main>
  );
}
