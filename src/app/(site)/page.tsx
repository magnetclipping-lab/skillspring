import Link from "next/link";
import {
  ArrowRight, Award, BadgeCheck, BookOpenCheck, Briefcase, CheckCircle2, ClipboardCheck, Cpu, FlaskConical,
  GraduationCap, IndianRupee, Layers, Megaphone, PlayCircle, Quote, ShieldCheck, Sparkles, TrendingUp, UserPlus,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { CourseCard, InternshipCard } from "@/components/site/cards";
import { FaqList, generalFaqs } from "@/components/site/faq-list";
import { getCategories, getInternships, getPublishedCourses } from "@/lib/data/catalogue";

const categoryIcons: Record<string, typeof TrendingUp> = { "trending-up": TrendingUp, cpu: Cpu, megaphone: Megaphone, briefcase: Briefcase };

export default async function HomePage() {
  const [courses, categories, internships] = await Promise.all([getPublishedCourses({ sort: "popular" }), getCategories(), getInternships()]);
  const featured = courses.slice(0, 6);
  const countByCategory = new Map<string, number>();
  courses.forEach((c) => c.category && countByCategory.set(c.category.slug, (countByCategory.get(c.category.slug) ?? 0) + 1));
  const hasDemo = courses.some((c) => c.is_demo);

  return (
    <>
      {/* Hero */}
      <section className="hero-gradient relative overflow-hidden text-white">
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-medium text-brand-100 ring-1 ring-white/15">
              <Sparkles className="size-3.5 text-highlight-400" /> Built for students across India
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[58px]">
              Learn Skills. <span className="bg-gradient-to-r from-brand-300 to-accent-400 bg-clip-text text-transparent">Build Experience.</span> Shape Your Future.
            </h1>
            <p className="mt-5 max-w-xl text-[17px] leading-8 text-brand-100/90">
              Affordable, practical and career-focused learning designed to prepare students for the real world.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/courses" variant="light" size="lg">Explore Courses <ArrowRight className="size-4" /></ButtonLink>
              <ButtonLink href="/internships" variant="outlineLight" size="lg">Explore Internships</ButtonLink>
            </div>
            <ul className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100/80">
              {["Verifiable certificates", "Secure Razorpay checkout", "Hands-on projects"].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400" />{t}</li>
              ))}
            </ul>
          </div>

          {/* Product illustration (UI mock, not data) */}
          <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
            <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-brand-500/30 to-accent-500/20 blur-2xl" />
            <div className="relative rounded-3xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-xl">
              <div className="rounded-2xl bg-white p-5 text-ink shadow-lift">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><PlayCircle className="size-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Module 2 · Lesson 3</p>
                    <p className="truncate font-display text-[15px] font-semibold">Building a three-statement model</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2.5">
                  {["Revenue build", "Balancing the balance sheet", "Cash flow statement"].map((l, i) => (
                    <div key={l} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm">
                      {i < 2 ? <CheckCircle2 className="size-4 text-emerald-500" /> : <span className="size-4 rounded-full border-2 border-brand-300" />}
                      <span className={i < 2 ? "text-ink-muted line-through decoration-ink-muted/40" : "font-medium"}>{l}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-[12px] font-medium text-ink-muted"><span>Course progress</span><span>Example</span></div>
                  <div className="h-2 rounded-full bg-brand-100"><div className="h-2 w-2/3 rounded-full bg-gradient-to-r from-brand-500 to-accent-500" /></div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/95 p-4 text-ink">
                  <Award className="size-5 text-accent-600" />
                  <p className="mt-2 text-[13px] font-semibold">Certificate</p>
                  <p className="text-[11.5px] text-ink-muted">Issued after verified completion</p>
                </div>
                <div className="rounded-2xl bg-white/95 p-4 text-ink">
                  <BadgeCheck className="size-5 text-emerald-600" />
                  <p className="mt-2 text-[13px] font-semibold">Verify online</p>
                  <p className="text-[11.5px] text-ink-muted">Unique ID + public link</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured courses */}
      <section className="container-page py-16 sm:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Featured courses</p>
            <h2 className="mt-2 text-3xl font-bold">Practical skills, taught step by step</h2>
            <p className="mt-2 max-w-2xl text-ink-muted">Short, structured courses with assignments and quizzes so you can prove what you&apos;ve learned.</p>
          </div>
          <ButtonLink href="/courses" variant="secondary">Browse all courses <ArrowRight className="size-4" /></ButtonLink>
        </div>
        {hasDemo ? (
          <p className="mt-5 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-1.5 text-[13px] text-amber-900 ring-1 ring-amber-200">
            Courses marked <strong>Demo</strong> are preview listings and are not yet available for purchase.
          </p>
        ) : null}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((c, i) => <CourseCard key={c.id} course={c} priority={i < 3} />)}
        </div>
      </section>

      {/* Categories */}
      <section className="border-y border-line bg-white">
        <div className="container-page py-16">
          <p className="eyebrow">Popular categories</p>
          <h2 className="mt-2 text-3xl font-bold">Find your next skill</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c) => {
              const Icon = categoryIcons[c.icon ?? ""] ?? Layers;
              const n = countByCategory.get(c.slug) ?? 0;
              return (
                <Link key={c.id} href={`/courses?category=${c.slug}`} className="group rounded-2xl border border-line bg-canvas p-5 transition hover:border-brand-200 hover:bg-brand-50/50">
                  <span className="grid size-11 place-items-center rounded-xl bg-white text-brand-600 shadow-soft"><Icon className="size-5" /></span>
                  <p className="mt-4 font-display text-[16px] font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-ink-muted">{c.description}</p>
                  <p className="mt-4 text-[13px] font-semibold text-brand-600">{n} {n === 1 ? "course" : "courses"} →</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why */}
      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <p className="eyebrow">Why SkillSpring</p>
            <h2 className="mt-2 text-3xl font-bold">Learning that respects your time and money</h2>
            <p className="mt-3 text-ink-muted">We keep prices student-friendly, teach what&apos;s actually used at work, and are honest about what a course can and cannot do for you.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: IndianRupee, t: "Student-friendly pricing", d: "Clear one-time prices in rupees. No hidden fees or subscriptions." },
              { icon: ClipboardCheck, t: "Practice, not just videos", d: "Assignments, quizzes and projects in every course." },
              { icon: Award, t: "Certificates you can verify", d: "Unique certificate IDs with a public verification page." },
              { icon: ShieldCheck, t: "Licensed, original content", d: "Every course must clear a content-rights review before it goes on sale." },
              { icon: FlaskConical, t: "Real-world projects", d: "Simulations and project briefs to build a portfolio." },
              { icon: Briefcase, t: "Honest career support", d: "Clearly labelled opportunities. No placement guarantees." },
            ].map(({ icon: Icon, t, d }) => (
              <div key={t} className="rounded-2xl border border-line bg-white p-5 shadow-soft">
                <Icon className="size-5 text-brand-600" />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1 text-sm leading-6 text-ink-muted">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="bg-brand-950 text-white">
        <div className="container-page py-16 sm:py-20">
          <p className="eyebrow !text-brand-300">How it works</p>
          <h2 className="mt-2 text-3xl font-bold text-white">From first lesson to verified certificate</h2>
          <ol className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              { icon: UserPlus, t: "Create your account", d: "Sign up free with your email and set up your profile." },
              { icon: BookOpenCheck, t: "Enrol in a course", d: "Pay securely with UPI, card or net banking via Razorpay." },
              { icon: GraduationCap, t: "Learn and practise", d: "Watch lessons, download resources, submit assignments and take quizzes." },
              { icon: Award, t: "Earn your certificate", d: "Meet the completion requirements and share your verifiable certificate." },
            ].map(({ icon: Icon, t, d }, i) => (
              <li key={t} className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6">
                <span className="font-display text-sm font-bold text-brand-300">0{i + 1}</span>
                <Icon className="mt-4 size-6 text-white" />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1.5 text-sm leading-6 text-brand-100/75">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Testimonials (clearly labelled placeholders) */}
      <section className="container-page py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="eyebrow">Student stories</p>
          <h2 className="mt-2 text-3xl font-bold">Hear from our learners</h2>
          <p className="mt-2 text-ink-muted">We&apos;re just getting started. Genuine reviews from enrolled students will appear here once collected.</p>
        </div>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <figure key={n} className="relative rounded-2xl border border-dashed border-line bg-white p-6">
              <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-600">Demo placeholder</span>
              <Quote className="size-6 text-brand-200" />
              <blockquote className="mt-3 text-sm leading-6 text-ink-muted">This space is reserved for a verified student testimonial. It will only show real feedback from enrolled learners, shared with their consent.</blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span className="size-9 rounded-full bg-slate-100" />
                <span className="text-sm text-ink-muted">Student name · College</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* Internships preview */}
      <section className="border-y border-line bg-white">
        <div className="container-page py-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow">Internships & projects</p>
              <h2 className="mt-2 text-3xl font-bold">Build experience while you learn</h2>
              <p className="mt-2 max-w-2xl text-ink-muted">Every listing is labelled: employer internships come from verified employers; simulations and projects are educational experiences run by SkillSpring.</p>
            </div>
            <ButtonLink href="/internships" variant="secondary">View all opportunities <ArrowRight className="size-4" /></ButtonLink>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {internships.slice(0, 3).map((i) => <InternshipCard key={i.id} internship={i} />)}
          </div>
        </div>
      </section>

      {/* Instructor partnership */}
      <section className="container-page py-16 sm:py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 via-brand-700 to-accent-600 p-8 text-white sm:p-12">
          <div className="grid-fade pointer-events-none absolute inset-0 opacity-60" aria-hidden />
          <div className="relative grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <p className="eyebrow !text-brand-200">For instructors & partners</p>
              <h2 className="mt-2 text-3xl font-bold text-white">Teach with SkillSpring</h2>
              <p className="mt-3 max-w-xl text-brand-100/90">Share your expertise with students across India. Publish original courses, earn a transparent revenue share and track your earnings in your instructor portal.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/become-instructor" variant="light">Become an instructor</ButtonLink>
                <ButtonLink href="/partners" variant="outlineLight">Partner with us</ButtonLink>
              </div>
            </div>
            <ul className="space-y-3 text-sm">
              {["Admin review for quality and content rights", "Revenue share recorded on every verified sale", "Course analytics and payout tracking", "Universities, employers and content partners welcome"].map((t) => (
                <li key={t} className="flex gap-3 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-white/15"><CheckCircle2 className="size-4 shrink-0 text-emerald-300" />{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-page pb-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="eyebrow">FAQs</p>
            <h2 className="mt-2 text-3xl font-bold">Questions, answered</h2>
            <p className="mt-3 text-ink-muted">Can&apos;t find what you need? <Link href="/contact" className="font-medium text-brand-600 hover:underline">Contact us</Link>.</p>
          </div>
          <FaqList items={generalFaqs} />
        </div>
      </section>
    </>
  );
}
