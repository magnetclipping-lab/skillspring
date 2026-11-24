import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, Check, ChevronDown, ClipboardList, Clock, FileSpreadsheet, FileText, FolderKanban, Hammer, Compass, Layers, Lock, Star } from "lucide-react";
import { getSessionUser } from "@/lib/auth/dal";
import { getCourseAssignmentSummaries, getCourseBySlug, getCourseOutline, getCourseReviews, getPublishedCourses, isPurchasable } from "@/lib/data/catalogue";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { FaqList } from "@/components/site/faq-list";
import { CourseMini } from "@/components/courses/course-card";
import { PreviewButton } from "@/components/courses/preview-player";
import { accentDot, accentText } from "@/components/courses/accent";
import { cn, formatDate, formatINR } from "@/lib/utils";
import type { AssignmentKind, LessonType } from "@/lib/types";
import { EnrolFreeButton, ReviewForm } from "./client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Course not found" };
  return {
    title: course.title,
    description: course.subtitle ?? course.description.slice(0, 155),
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { title: course.title, description: course.subtitle ?? undefined, images: course.thumbnail_url ? [course.thumbnail_url] : undefined },
  };
}

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const KIND: Record<AssignmentKind, { label: string; icon: typeof FileText; note: string }> = {
  file: { label: "Workbook", icon: FileSpreadsheet, note: "Excel workbook provided · formulas and values checked" },
  document: { label: "Written", icon: FileText, note: "Word brief provided · rubric and answer key" },
  practical: { label: "Practical project", icon: Hammer, note: "Real work with evidence · files, links, screenshots" },
  scenario: { label: "Scenario challenge", icon: Compass, note: "Diagnose, decide and justify" },
};
const lessonIcon: Partial<Record<LessonType, typeof FileText>> = { assignment: ClipboardList, quiz: BarChart3 };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-24 border-t border-line pt-10">
      <h2 id={id} className="font-display text-[26px] font-semibold tracking-tight">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course || course.status === "archived") notFound();

  const [outline, assignments, reviews, user, all] = await Promise.all([
    getCourseOutline(course), getCourseAssignmentSummaries(course), getCourseReviews(course.id), getSessionUser(), getPublishedCourses(),
  ]);
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
  const lessonCount = outline.reduce((n, m) => n + m.lessons.filter((l) => l.type !== "assignment" && l.type !== "quiz").length, 0);
  const related = all.filter((c) => c.category?.slug === course.category?.slug && c.slug !== course.slug).slice(0, 4);
  const short = course.title.split(" — ")[0];
  const discounted = course.effective_price < course.price_paise;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.subtitle ?? course.description.slice(0, 300),
    url: `${publicEnv.siteUrl}/courses/${course.slug}`,
    inLanguage: "en-IN",
    provider: { "@type": "Organization", name: "Proofwork", sameAs: publicEnv.siteUrl },
    ...(purchasable ? { offers: { "@type": "Offer", price: (course.effective_price / 100).toFixed(2), priceCurrency: "INR", category: "Paid" } } : {}),
    ...(course.review_count > 0 && course.avg_rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: course.avg_rating, reviewCount: course.review_count } } : {}),
  };

  const cta = enrolled ? (
    <Link href={`/dashboard/learning/${course.slug}`} className="btn-primary w-full">Continue learning</Link>
  ) : !purchasable ? (
    <div className="space-y-3">
      <button disabled className="h-12 w-full cursor-not-allowed rounded-lg bg-white/[0.06] text-[15px] font-semibold text-ink-muted">Enrolment not open</button>
      <Link href="/contact?topic=general" className="block text-center text-[14px] font-semibold text-violet-300 hover:underline">Ask us about this course</Link>
    </div>
  ) : course.effective_price === 0 ? (
    user ? <EnrolFreeButton courseId={course.id} slug={course.slug} /> : <Link href={`/login?next=/courses/${course.slug}`} className="btn-primary w-full">Log in to enrol</Link>
  ) : (
    <Link href={user ? `/checkout/${course.slug}` : `/login?next=/checkout/${course.slug}`} className="btn-primary w-full">Enrol now</Link>
  );

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="hero-gradient border-b border-line">
        <div className="container-page grid gap-12 pb-14 pt-10 lg:grid-cols-[1fr_400px] lg:pb-20">
          <div>
            <nav aria-label="Breadcrumb" className="text-[13.5px] text-ink-muted">
              <Link href="/courses" className="hover:text-ink">Courses</Link>
              <span className="mx-2">/</span>
              <Link href={`/courses?category=${course.category?.slug}`} className={cn("font-medium hover:underline", accentText(course.category?.accent))}>{course.category?.name}</Link>
            </nav>
            <h1 className="display mt-6 text-[42px] sm:text-[60px]">{short}</h1>
            {course.title.includes(" — ") ? <p className="mt-2 font-display text-xl text-ink-soft">{course.title.split(" — ")[1]}</p> : null}
            <p className="mt-5 max-w-2xl text-[18px] leading-8 text-ink-soft">{course.subtitle}</p>
            <dl className="mt-9 grid max-w-2xl grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
              {[
                [Clock, "Duration", `${Math.round(course.duration_minutes / 60)} hours`],
                [Layers, "Modules", `${outline.length || course.module_count}`],
                [FolderKanban, "Projects", `${course.projects_count ?? 0}`],
                [BarChart3, "Level", LEVEL[course.level]],
              ].map(([Icon, k, v]) => {
                const I = Icon as typeof Clock;
                return (
                  <div key={k as string}>
                    <dt className="flex items-center gap-1.5 text-[12.5px] text-ink-muted"><I className="size-3.5" />{k as string}</dt>
                    <dd className="mt-1 font-display text-lg font-semibold">{v as string}</dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <aside className="lg:row-span-2">
            <div className="overflow-hidden rounded-xl border border-line bg-surface lg:sticky lg:top-24">
              <div className="relative aspect-video bg-raised">
                {course.thumbnail_url ? <Image src={course.thumbnail_url} alt="" fill priority className="object-cover" sizes="400px" unoptimized={course.thumbnail_url.endsWith(".svg")} /> : null}
                <PreviewButton variant="overlay" className="opacity-100 hover:bg-black/30" title={short} src={course.preview_video_url} poster={course.preview_poster_url ?? course.thumbnail_url} />
              </div>
              <div className="space-y-5 p-6">
                <div className="flex items-baseline gap-3">
                  <p className="font-display text-[34px] font-semibold">{formatINR(course.effective_price)}</p>
                  {discounted ? <p className="text-ink-muted line-through">{formatINR(course.price_paise)}</p> : null}
                </div>
                {cta}
                <ul className="space-y-2.5 text-[13.5px] text-ink-soft">
                  {[
                    `${lessonCount} lessons across ${outline.length} modules`,
                    `${assignments.length} graded assignments + course quiz`,
                    "Rubric-based feedback, usually within ~1 hour",
                    "Lifetime access · learn at your own pace",
                    "Refund within 7 days if under 25% complete",
                  ].map((t) => <li key={t} className="flex gap-2.5"><Check className="mt-0.5 size-4 shrink-0 text-cyan-400" />{t}</li>)}
                </ul>
                <p className="flex items-center gap-1.5 border-t border-line pt-4 text-[12px] text-ink-muted"><Lock className="size-3.5" />Secure payment via Razorpay · UPI, cards, net banking</p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="container-page grid gap-12 py-14 lg:grid-cols-[1fr_400px]">
        <div className="space-y-14">
          <Section id="about" title="About this course">
            <p className="max-w-3xl text-[16px] leading-8 text-ink-soft">{course.description}</p>
          </Section>

          <Section id="outcomes" title="What you'll be able to do">
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {course.learning_outcomes.map((o) => <li key={o} className="flex gap-3 text-[15px] leading-6 text-ink-soft"><Check className="mt-1 size-4 shrink-0 text-cyan-400" />{o}</li>)}
            </ul>
          </Section>

          <Section id="curriculum" title="Curriculum">
            <div className="divide-y divide-line border-y border-line">
              {outline.map((m, i) => (
                <details key={m.id} open={i === 0} className="group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer list-none items-center gap-4 py-5">
                    <span className="font-mono text-[12.5px] text-ink-muted">{String(i + 1).padStart(2, "0")}</span>
                    <span className="flex-1 font-display text-[17px] font-semibold">{m.title}</span>
                    <span className="text-[12.5px] text-ink-muted">{m.lessons.length} items</span>
                    <ChevronDown className="size-4 text-ink-muted transition group-open:rotate-180" />
                  </summary>
                  <ul className="pb-5 pl-10">
                    {m.lessons.map((l) => {
                      const Icon = lessonIcon[l.type] ?? FileText;
                      return (
                        <li key={l.id} className="flex items-center gap-3 py-2 text-[14.5px] text-ink-soft">
                          <Icon className={cn("size-4 shrink-0", l.type === "assignment" ? "text-violet-300" : l.type === "quiz" ? "text-cyan-400" : "text-ink-muted")} />
                          <span className="flex-1">{l.title}</span>
                          {l.is_preview ? <Link href={`/courses/${course.slug}/preview/${l.id}`} className="text-[12.5px] font-semibold text-violet-300 hover:underline">Preview</Link> : null}
                          <span className="text-[12.5px] text-ink-muted">{l.duration_minutes} min</span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </Section>

          <Section id="assignments" title="Assignments you'll complete">
            <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
              {assignments.map((a) => {
                const k = KIND[a.kind];
                return (
                  <div key={a.id} className="bg-canvas p-6">
                    <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-violet-300"><k.icon className="size-3.5" />{k.label}</p>
                    <h3 className="mt-3 font-display text-[17px] font-semibold">{a.title}</h3>
                    {a.summary ? <p className="mt-2 line-clamp-3 text-[14px] leading-6 text-ink-muted">{a.summary}</p> : null}
                    <p className="mt-4 text-[12.5px] text-ink-muted">{k.note}{a.estimated_minutes ? ` · ~${Math.round(a.estimated_minutes / 60 * 10) / 10} hrs` : ""}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[13.5px] text-ink-muted">Plus a course knowledge check with mixed question types, marked instantly. Written and project work is evaluated against a published rubric; a person can review any result.</p>
          </Section>

          {course.requirements.length ? (
            <Section id="requirements" title="Before you start">
              <ul className="space-y-2.5">{course.requirements.map((r) => <li key={r} className="flex gap-3 text-[15px] text-ink-soft"><span className="mt-2.5 size-1 shrink-0 rounded-full bg-ink-muted" />{r}</li>)}</ul>
            </Section>
          ) : null}

          {course.instructor ? (
            <Section id="instructor" title="Instructor">
              <div className="flex gap-4">
                {course.instructor.avatar_url ? <Image src={course.instructor.avatar_url} alt="" width={64} height={64} className="size-16 rounded-lg object-cover" /> : null}
                <div>
                  <p className="font-display text-lg font-semibold">{course.instructor.display_name}</p>
                  {course.instructor.headline ? <p className="text-[14px] text-violet-300">{course.instructor.headline}</p> : null}
                  {course.instructor.bio ? <p className="mt-3 max-w-2xl text-[14.5px] leading-7 text-ink-soft">{course.instructor.bio}</p> : null}
                </div>
              </div>
            </Section>
          ) : null}

          {course.faqs.length ? (
            <Section id="faqs" title="Questions">
              <FaqList items={course.faqs.map((f) => ({ q: f.question, a: f.answer }))} />
            </Section>
          ) : null}

          {reviews.length || enrolled ? (
            <Section id="reviews" title="Learner reviews">
              {reviews.length ? (
                <ul className="divide-y divide-line border-y border-line">
                  {reviews.map((r) => (
                    <li key={r.id} className="py-5">
                      <div className="flex items-center gap-3">
                        <span className="flex" aria-label={`${r.rating} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={cn("size-4", n <= r.rating ? "fill-cyan-400 text-cyan-400" : "text-ink-muted/40")} />)}</span>
                        <span className="text-[12.5px] text-ink-muted">Verified learner · {formatDate(r.created_at)}</span>
                      </div>
                      {r.comment ? <p className="mt-2 text-[15px] leading-7 text-ink-soft">{r.comment}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-[14px] text-ink-muted">No reviews yet.</p>}
              {enrolled ? <div className="mt-6"><ReviewForm courseId={course.id} slug={course.slug} existing={myReview} /></div> : null}
            </Section>
          ) : null}
        </div>

        {related.length ? (
          <aside aria-labelledby="related" className="lg:pt-10">
            <h2 id="related" className="kicker flex items-center gap-2"><span className={cn("size-1.5 rounded-full", accentDot(course.category?.accent))} />More in {course.category?.name}</h2>
            <div className="mt-2">{related.map((c) => <CourseMini key={c.id} c={c} />)}</div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
