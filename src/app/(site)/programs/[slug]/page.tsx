import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award, BadgeCheck, BarChart3, Briefcase, Check, ChevronDown, ClipboardList, Clock, FileText, Globe, Lock, PlayCircle,
  ShieldCheck, Star, Video, Wrench,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/dal";
import { getCourseBySlug, getCourseOutline, getCourseReviews, getPrograms, isPurchasable } from "@/lib/data/catalogue";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getProgram, HUE, type ProgramDetails } from "@/lib/programs";
import { ProgramShowcase } from "@/components/programs/showcase";
import { FaqList } from "@/components/site/faq-list";
import { CertificateView } from "@/components/certificate";
import { cn, formatDate, formatDuration, formatINR, titleCase } from "@/lib/utils";
import { EnrolFreeButton, ReviewForm } from "./client";
import type { LessonType } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Program not found" };
  return {
    title: course.title,
    description: course.subtitle ?? course.description.slice(0, 155),
    alternates: { canonical: `/programs/${course.slug}` },
    openGraph: { title: course.title, description: course.subtitle ?? undefined },
  };
}

const lessonIcon: Record<LessonType, typeof Video> = { video: Video, text: FileText, pdf: FileText, external: Globe, assignment: ClipboardList, quiz: BarChart3 };

function Section({ id, title, children, className }: { id: string; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn("scroll-mt-28", className)}>
      <h2 id={id} className="display text-[32px] sm:text-[38px]">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function ProgramPage({ params }: Props) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const fallback: ProgramDetails = {
    slug, category: course.category?.slug ?? "", name: course.title, shortName: course.title, hue: "web", showcase: "code",
    pitch: course.subtitle ?? "", duration: formatDuration(course.duration_minutes), weeklyEffort: "Self-paced", format: "Self-paced video lessons",
    audience: [], projects: [], tools: [], careers: [], includes: [],
  };
  const p = getProgram(slug) ?? fallback;
  const h = HUE[p.hue];

  const [outline, reviews, user, allPrograms] = await Promise.all([getCourseOutline(course), getCourseReviews(course.id), getSessionUser(), getPrograms()]);
  let enrolment: { status: string } | null = null;
  let myReview: { rating: number; comment: string | null } | null = null;
  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    const [{ data: e }, { data: r }] = await Promise.all([
      supabase.from("enrolments").select("status").eq("course_id", course.id).eq("user_id", user.id).maybeSingle(),
      supabase.from("reviews").select("rating, comment").eq("course_id", course.id).eq("user_id", user.id).maybeSingle(),
    ]);
    enrolment = e;
    myReview = r;
  }
  const enrolled = enrolment?.status === "active";
  const purchasable = isPurchasable(course);
  const lessonCount = outline.reduce((n, m) => n + m.lessons.length, 0);
  const assignmentCount = outline.reduce((n, m) => n + m.lessons.filter((l) => l.type === "assignment").length, 0);
  const quizCount = outline.reduce((n, m) => n + m.lessons.filter((l) => l.type === "quiz").length, 0);
  const discounted = course.effective_price < course.price_paise;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.subtitle ?? course.description.slice(0, 300),
    url: `${publicEnv.siteUrl}/programs/${course.slug}`,
    inLanguage: course.language,
    provider: { "@type": "Organization", name: "Proofwork", sameAs: publicEnv.siteUrl },
    ...(purchasable ? { offers: { "@type": "Offer", price: (course.effective_price / 100).toFixed(2), priceCurrency: "INR" } } : {}),
    ...(course.review_count > 0 && course.avg_rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: course.avg_rating, reviewCount: course.review_count } } : {}),
  };

  const cta = enrolled ? (
    <Link href={`/dashboard/learning/${course.slug}`} className="flex h-13 w-full items-center justify-center rounded-full bg-ink py-3.5 text-[15px] font-semibold text-canvas hover:bg-white">Continue learning</Link>
  ) : !purchasable ? (
    <div className="space-y-3">
      <button disabled className="h-13 w-full cursor-not-allowed rounded-full bg-ink/8 py-3.5 text-[15px] font-semibold text-ink-soft">Enrolment opens soon</button>
      <Link href="/contact?topic=general" className="block text-center text-[14px] font-semibold text-brand-300 hover:underline">Ask us about this program</Link>
    </div>
  ) : course.effective_price === 0 ? (
    user ? <EnrolFreeButton courseId={course.id} slug={course.slug} /> : <Link href={`/login?next=/programs/${course.slug}`} className="flex w-full items-center justify-center rounded-full bg-ink py-3.5 text-[15px] font-semibold text-canvas">Log in to enrol free</Link>
  ) : (
    <Link href={user ? `/checkout/${course.slug}` : `/login?next=/checkout/${course.slug}`} className="flex w-full items-center justify-center rounded-full bg-ink py-3.5 text-[15px] font-semibold text-canvas hover:bg-white">Enrol now</Link>
  );

  const others = allPrograms.filter((o) => o.slug !== slug);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div className={cn("pointer-events-none absolute -left-40 -top-40 size-[36rem] rounded-full opacity-25 blur-3xl", h.solid)} aria-hidden />
        <div className="grid-fade pointer-events-none absolute inset-0" aria-hidden />
        <div className="container-page relative grid gap-12 pb-16 pt-10 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-20 lg:pt-14">
          <div>
            <nav aria-label="Breadcrumb" className="text-[14px] text-ink-muted">
              <Link href="/programs" className="hover:text-ink">Programs</Link>
              <span className="mx-2">/</span>
              <span className={cn("font-medium", h.text)}>{course.category?.name ?? p.shortName}</span>
            </nav>
            <h1 className="display mt-6 text-[52px] sm:text-[72px]">{course.title}</h1>
            <p className="mt-5 max-w-xl text-[18px] leading-8 text-ink-soft">{course.subtitle}</p>
            <dl className="mt-9 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
              {[
                ["Duration", p.duration],
                ["Time", p.weeklyEffort],
                ["Level", titleCase(course.level)],
                ["Language", course.language],
              ].map(([k, val]) => (
                <div key={k} className="border-l-2 border-ink/15 pl-3"><dt className="text-[13px] text-ink-muted">{k}</dt><dd className="mt-0.5 text-[15px] font-semibold text-ink">{val}</dd></div>
              ))}
            </dl>
            {course.review_count > 0 && course.avg_rating ? (
              <p className="mt-6 flex items-center gap-1.5 text-[14px] text-ink-soft"><Star className="size-4 fill-marigold-400 text-marigold-400" />{course.avg_rating.toFixed(1)} from {course.review_count} verified learners</p>
            ) : null}
          </div>
          <ProgramShowcase kind={p.showcase} hue={p.hue} />
        </div>
      </section>

      <div className="container-page grid gap-14 py-16 lg:grid-cols-[1fr_360px] lg:gap-16">
        <div className="min-w-0 space-y-20">
          <Section id="overview" title="About this program">
            <p className="max-w-[68ch] whitespace-pre-line text-[17px] leading-8 text-ink-soft">{course.description}</p>
            {p.audience.length ? (
              <div className="mt-10">
                <h3 className="font-display text-[20px] font-semibold">Who it&apos;s for</h3>
                <ul className="mt-4 space-y-3">
                  {p.audience.map((a) => <li key={a} className="flex gap-3 text-[16px] text-ink-soft"><span className={cn("mt-2.5 size-1.5 shrink-0 rounded-full", h.dot)} />{a}</li>)}
                </ul>
              </div>
            ) : null}
          </Section>

          {course.learning_outcomes.length ? (
            <Section id="outcomes" title="What you'll be able to do">
              <ul className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
                {course.learning_outcomes.map((o) => (
                  <li key={o} className="flex gap-3 text-[16px] leading-7 text-ink">
                    <Check className={cn("mt-1 size-5 shrink-0", h.text)} strokeWidth={2.5} />{o}
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          <Section id="curriculum" title="Curriculum">
            <p className="-mt-2 mb-6 text-[15px] text-ink-muted">{outline.length} modules, {lessonCount} lessons, {formatDuration(course.duration_minutes)} of content</p>
            <div className="divide-y divide-ink/8 overflow-hidden rounded-[24px] bg-surface ring-1 ring-ink/8">
              {outline.map((m, mi) => (
                <details key={m.id} open={mi === 0} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-4 px-6 py-5 hover:bg-canvas [&::-webkit-details-marker]:hidden">
                    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full font-display text-[14px] font-bold", h.tint, h.text)}>{mi + 1}</span>
                    <span className="flex-1">
                      <span className="block font-display text-[17px] font-semibold text-ink">{m.title}</span>
                      <span className="text-[13px] text-ink-muted">{m.lessons.length} lessons, {formatDuration(m.lessons.reduce((s, l) => s + l.duration_minutes, 0))}</span>
                    </span>
                    <ChevronDown className="size-5 text-ink-muted transition-transform group-open:rotate-180" />
                  </summary>
                  <ul className="border-t border-ink/6 bg-canvas/60 px-6 py-2">
                    {m.lessons.map((l) => {
                      const Icon = lessonIcon[l.type];
                      const canPreview = l.is_preview && !course.id.startsWith("preview-");
                      return (
                        <li key={l.id} className="flex items-center justify-between gap-3 py-3 text-[15px]">
                          <span className="flex items-center gap-3 text-ink-soft"><Icon className="size-4 shrink-0 text-ink-muted" />{l.title}</span>
                          <span className="flex shrink-0 items-center gap-3 text-[13px] text-ink-muted">
                            {l.is_preview ? (canPreview ? <Link href={`/courses/${course.slug}/preview/${l.id}`} className="font-semibold text-brand-300 hover:underline">Preview</Link> : <span className="font-medium text-brand-300">Free preview</span>) : <Lock className="size-3.5" aria-label="Unlocks after enrolment" />}
                            {l.duration_minutes ? `${l.duration_minutes} min` : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </Section>

          {p.projects.length ? (
            <Section id="projects" title="Projects you'll build">
              <ol className="grid gap-4 sm:grid-cols-2">
                {p.projects.map((pr, i) => (
                  <li key={pr.title} className={cn("rounded-[22px] p-6", i === p.projects.length - 1 ? "border border-marigold-400/25 bg-[linear-gradient(135deg,#1a150b,#0e1015_60%)] sm:col-span-2" : "card")}>
                    <p className={cn("text-[13px] font-semibold", i === p.projects.length - 1 ? "text-marigold-300" : h.text)}>{i === p.projects.length - 1 ? "Capstone" : `Project ${i + 1}`}</p>
                    <p className={cn("mt-2 font-display text-[20px] font-semibold", i === p.projects.length - 1 ? "text-white" : "text-ink")}>{pr.title}</p>
                    <p className={cn("mt-1.5 text-[15px] leading-6", i === p.projects.length - 1 ? "text-white/70" : "text-ink-muted")}>{pr.description}</p>
                  </li>
                ))}
              </ol>
            </Section>
          ) : null}

          {p.tools.length ? (
            <Section id="tools" title="Tools you'll use">
              <ul className="flex flex-wrap gap-2.5">
                {p.tools.map((t) => <li key={t} className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[15px] font-medium text-ink ring-1 ring-ink/10"><Wrench className={cn("size-4", h.text)} />{t}</li>)}
              </ul>
            </Section>
          ) : null}

          <Section id="certificate" title="Your certificate">
            <div className="grid gap-8">
              <div>
                <p className="text-[16px] leading-7 text-ink-soft">You earn your certificate by finishing the work, not just by paying. It&apos;s issued when you:</p>
                <ul className="mt-5 space-y-3 text-[15.5px] text-ink">
                  {course.completion_requires_all_lessons ? <li className="flex gap-3"><BadgeCheck className={cn("size-5 shrink-0", h.text)} />Complete every mandatory lesson</li> : null}
                  {course.completion_requires_assignments && assignmentCount ? <li className="flex gap-3"><BadgeCheck className={cn("size-5 shrink-0", h.text)} />Submit all {assignmentCount} assignments</li> : null}
                  {quizCount ? <li className="flex gap-3"><BadgeCheck className={cn("size-5 shrink-0", h.text)} />Pass the {quizCount} module quizzes{course.completion_min_quiz_pct ? ` with at least ${course.completion_min_quiz_pct}%` : ""}</li> : null}
                </ul>
                <p className="mt-5 text-[14px] text-ink-muted">Each certificate has a unique ID that recruiters can check on our <Link href="/verify" className="font-medium text-brand-300 hover:underline">verification page</Link>.</p>
              </div>
              <div className="max-w-2xl rounded-[22px] bg-surface p-2.5 ring-1 ring-ink/8">
                <CertificateView cert={{ certificate_code: "SS-2026-SAMPLE0001", student_name: "Your name here", course_title: course.title, issued_at: "2026-11-23", status: "valid" }} />
              </div>
            </div>
          </Section>

          {p.careers.length ? (
            <Section id="careers" title="Where it can take you">
              <p className="-mt-2 mb-5 max-w-[60ch] text-[15px] text-ink-muted">Roles that use these skills. A program builds your skills and portfolio; it isn&apos;t a job guarantee.</p>
              <ul className="grid gap-3 sm:grid-cols-2">
                {p.careers.map((c) => <li key={c} className="flex items-center gap-3 rounded-2xl bg-surface px-5 py-4 text-[15.5px] font-medium text-ink ring-1 ring-ink/8"><Briefcase className={cn("size-5", h.text)} />{c}</li>)}
              </ul>
            </Section>
          ) : null}

          {course.faqs.length ? (
            <Section id="faq" title="Frequently asked questions">
              <FaqList items={course.faqs.map((f) => ({ q: f.question, a: f.answer }))} />
            </Section>
          ) : null}

          <Section id="reviews" title="Reviews">
            {reviews.length ? (
              <ul className="space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-[22px] bg-surface p-6 ring-1 ring-ink/8">
                    <div className="flex items-center gap-1" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} className={i < r.rating ? "size-4 fill-marigold-400 text-marigold-400" : "size-4 text-ink/15"} />)}
                      <span className="ml-2 text-[13px] text-ink-muted">Verified learner, {formatDate(r.created_at)}</span>
                    </div>
                    {r.comment ? <p className="mt-3 text-[15.5px] leading-7 text-ink-soft">{r.comment}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15.5px] text-ink-muted">No reviews yet. Only learners enrolled in this program can review it.</p>
            )}
            {enrolled ? <div className="mt-5"><ReviewForm courseId={course.id} slug={course.slug} existing={myReview} /></div> : null}
          </Section>
        </div>

        {/* Price card */}
        <aside className="lg:order-none">
          <div className="sticky top-24 rounded-[28px] bg-surface p-7 shadow-[0_30px_70px_-40px_rgb(20_22_58/0.45)] ring-1 ring-ink/8">
            <p className="text-[14px] font-medium text-ink-muted">{course.is_demo ? "Price at launch" : "One-time payment"}</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-[48px] font-bold tracking-tight text-ink">{formatINR(course.effective_price)}</span>
              {discounted ? <span className="text-[17px] text-ink-muted line-through">{formatINR(course.price_paise)}</span> : null}
            </div>
            {discounted && course.discount_ends_at ? <p className="text-[13px] font-medium text-digital">Offer ends {formatDate(course.discount_ends_at)}</p> : null}
            <div className="mt-6">{cta}</div>
            <ul className="mt-7 space-y-3 border-t border-ink/8 pt-6 text-[14.5px] text-ink-soft">
              <li className="flex gap-3"><PlayCircle className="size-4.5 shrink-0 text-ink-muted" />{lessonCount} lessons, {formatDuration(course.duration_minutes)}</li>
              <li className="flex gap-3"><ClipboardList className="size-4.5 shrink-0 text-ink-muted" />{assignmentCount} assignments, {quizCount} quizzes</li>
              <li className="flex gap-3"><Clock className="size-4.5 shrink-0 text-ink-muted" />{p.duration} at {p.weeklyEffort}</li>
              <li className="flex gap-3"><Award className="size-4.5 shrink-0 text-ink-muted" />Verifiable certificate</li>
              <li className="flex gap-3"><ShieldCheck className="size-4.5 shrink-0 text-ink-muted" />Secure payment with Razorpay</li>
            </ul>
            <p className="mt-6 text-[13px] text-ink-muted">7-day refund window. See the <Link href="/refund-policy" className="underline">refund policy</Link>.</p>
          </div>
        </aside>
      </div>

      {/* Other programs */}
      {others.length ? (
        <section className="border-t border-ink/8 bg-surface py-16" aria-labelledby="others-heading">
          <div className="container-page">
            <h2 id="others-heading" className="display text-[32px] sm:text-[38px]">Explore other programs</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {others.map((o) => (
                <Link key={o.slug} href={`/programs/${o.slug}`} className="card card-hover p-6">
                  <span className={cn("block h-1.5 w-8 rounded-full", HUE[o.hue].solid)} />
                  <p className="mt-5 font-display text-[22px] font-semibold text-ink">{o.name}</p>
                  <p className="mt-1.5 text-[14.5px] text-ink-soft">{o.pitch}</p>
                  <p className="mt-5 font-display text-[20px] font-bold text-ink">{o.course ? formatINR(o.course.effective_price) : ""}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
