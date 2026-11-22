import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Award, BarChart3, CheckCircle2, ClipboardList, Clock, FileText, Globe, Lock, PlayCircle, ShieldCheck, Star, TriangleAlert, Video,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth/dal";
import { getCourseBySlug, getCourseOutline, getCourseReviews, isPurchasable } from "@/lib/data/catalogue";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { PriceTag } from "@/components/site/cards";
import { FaqList } from "@/components/site/faq-list";
import { formatDate, formatDuration, titleCase } from "@/lib/utils";
import { EnrolFreeButton, ReviewForm } from "./client";
import type { LessonType } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return { title: "Course not found" };
  return {
    title: course.title,
    description: course.subtitle ?? course.description.slice(0, 155),
    alternates: { canonical: `/courses/${course.slug}` },
    openGraph: { title: course.title, description: course.subtitle ?? undefined, images: course.thumbnail_url && !course.thumbnail_url.endsWith(".svg") ? [course.thumbnail_url] : undefined },
  };
}

const lessonIcon: Record<LessonType, typeof Video> = { video: Video, text: FileText, pdf: FileText, external: Globe, assignment: ClipboardList, quiz: BarChart3 };

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const [outline, reviews, user] = await Promise.all([getCourseOutline(course), getCourseReviews(course.id), getSessionUser()]);
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: course.title,
    description: course.subtitle ?? course.description.slice(0, 300),
    url: `${publicEnv.siteUrl}/courses/${course.slug}`,
    inLanguage: course.language,
    provider: { "@type": "Organization", name: "SkillSpring", sameAs: publicEnv.siteUrl },
    ...(purchasable ? { offers: { "@type": "Offer", price: (course.effective_price / 100).toFixed(2), priceCurrency: "INR", category: course.effective_price === 0 ? "Free" : "Paid" } } : {}),
    ...(course.review_count > 0 && course.avg_rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: course.avg_rating, reviewCount: course.review_count } } : {}),
  };

  const cta = enrolled ? (
    <ButtonLink href={`/dashboard/learning/${course.slug}`} size="lg" className="w-full">Go to course</ButtonLink>
  ) : !purchasable ? (
    <button disabled className="h-12 w-full cursor-not-allowed rounded-xl bg-slate-100 text-[15px] font-semibold text-ink-muted">Not yet available for purchase</button>
  ) : course.effective_price === 0 ? (
    user ? <EnrolFreeButton courseId={course.id} slug={course.slug} /> : <ButtonLink href={`/login?next=/courses/${course.slug}`} size="lg" className="w-full">Log in to enrol free</ButtonLink>
  ) : (
    <ButtonLink href={user ? `/checkout/${course.slug}` : `/login?next=/checkout/${course.slug}`} size="lg" className="w-full">Buy now</ButtonLink>
  );

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <section className="hero-gradient text-white">
        <div className="container-page grid gap-10 py-12 lg:grid-cols-[1.6fr_1fr] lg:py-16">
          <div>
            <nav aria-label="Breadcrumb" className="text-[13px] text-brand-200">
              <Link href="/courses" className="hover:text-white">Courses</Link>
              {course.category ? <> / <Link href={`/courses?category=${course.category.slug}`} className="hover:text-white">{course.category.name}</Link></> : null}
            </nav>
            <div className="mt-4 flex flex-wrap gap-2">
              {course.is_demo ? <Badge tone="warning">Demo · Not yet available for purchase</Badge> : null}
              <Badge tone="dark">{titleCase(course.level)}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-white sm:text-[40px] sm:leading-tight">{course.title}</h1>
            {course.subtitle ? <p className="mt-3 max-w-2xl text-lg text-brand-100/90">{course.subtitle}</p> : null}
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-brand-100/85">
              <span className="flex items-center gap-1.5"><Clock className="size-4" />{formatDuration(course.duration_minutes)} total</span>
              <span className="flex items-center gap-1.5"><PlayCircle className="size-4" />{lessonCount} lessons</span>
              <span className="flex items-center gap-1.5"><Globe className="size-4" />{course.language}</span>
              {course.review_count > 0 && course.avg_rating ? <span className="flex items-center gap-1.5"><Star className="size-4 fill-highlight-400 text-highlight-400" />{course.avg_rating.toFixed(1)} · {course.review_count} reviews</span> : null}
            </div>
            <p className="mt-5 text-sm text-brand-100/85">Instructor: <span className="font-semibold text-white">{course.instructor?.display_name ?? "To be announced"}</span></p>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-10 py-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-10 lg:order-1">
          {course.is_demo ? (
            <Alert tone="warning" title="This is a demo course listing">
              The curriculum below shows the planned structure. The course will open for purchase once its material and instructor rights are approved.
            </Alert>
          ) : null}

          <section>
            <h2 className="text-xl font-bold">About this course</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-ink-soft">{course.description}</p>
          </section>

          {course.learning_outcomes.length ? (
            <section className="rounded-2xl border border-line bg-white p-6">
              <h2 className="text-xl font-bold">What you&apos;ll learn</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {course.learning_outcomes.map((o) => <li key={o} className="flex gap-2.5 text-sm text-ink-soft"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />{o}</li>)}
              </ul>
            </section>
          ) : null}

          <section>
            <div className="flex items-end justify-between">
              <h2 className="text-xl font-bold">Curriculum</h2>
              <p className="text-sm text-ink-muted">{outline.length} modules · {lessonCount} lessons</p>
            </div>
            <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {outline.map((m, mi) => (
                <details key={m.id} open={mi === 0} className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
                    <span className="font-semibold"><span className="mr-2 text-ink-muted">{String(mi + 1).padStart(2, "0")}</span>{m.title}</span>
                    <span className="text-[13px] text-ink-muted">{m.lessons.length} lessons · {formatDuration(m.lessons.reduce((s, l) => s + l.duration_minutes, 0))}</span>
                  </summary>
                  <ul className="border-t border-line bg-slate-50/50 px-5 py-2">
                    {m.lessons.map((l) => {
                      const Icon = lessonIcon[l.type];
                      const canPreview = l.is_preview && !course.id.startsWith("preview-");
                      return (
                        <li key={l.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <span className="flex items-center gap-2.5 text-ink-soft"><Icon className="size-4 text-ink-muted" />{l.title}</span>
                          <span className="flex shrink-0 items-center gap-3 text-[12.5px] text-ink-muted">
                            {l.is_preview ? (canPreview ? <Link href={`/courses/${course.slug}/preview/${l.id}`} className="font-semibold text-brand-600 hover:underline">Preview</Link> : <Badge tone="brand">Preview</Badge>) : <Lock className="size-3.5" aria-label="Locked" />}
                            {l.duration_minutes ? `${l.duration_minutes} min` : null}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              ))}
            </div>
          </section>

          {course.requirements.length ? (
            <section>
              <h2 className="text-xl font-bold">Requirements</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-soft">{course.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-line bg-white p-6">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Award className="size-5 text-accent-600" />Certificate eligibility</h2>
            <p className="mt-2 text-sm text-ink-muted">A certificate with a unique, publicly verifiable ID is issued only when you:</p>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {course.completion_requires_all_lessons ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-brand-500" />Complete all mandatory lessons</li> : null}
              {course.completion_requires_assignments && assignmentCount ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-brand-500" />Submit all required assignments ({assignmentCount})</li> : null}
              {quizCount ? <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 text-brand-500" />Pass the course quizzes{course.completion_min_quiz_pct ? ` with at least ${course.completion_min_quiz_pct}%` : ""}</li> : null}
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold">Your instructor</h2>
            {course.instructor ? (
              <div className="mt-4 flex gap-4 rounded-2xl border border-line bg-white p-5">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-brand-100">
                  {course.instructor.avatar_url ? <Image src={course.instructor.avatar_url} alt="" fill className="object-cover" sizes="64px" /> : null}
                </div>
                <div>
                  <p className="font-semibold">{course.instructor.display_name}</p>
                  {course.instructor.headline ? <p className="text-sm text-ink-muted">{course.instructor.headline}</p> : null}
                  {course.instructor.bio ? <p className="mt-2 text-sm leading-6 text-ink-soft">{course.instructor.bio}</p> : null}
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-line bg-white p-5 text-sm text-ink-muted">The instructor for this course will be announced when it launches.</p>
            )}
          </section>

          {course.faqs.length ? (
            <section>
              <h2 className="mb-4 text-xl font-bold">Frequently asked questions</h2>
              <FaqList items={course.faqs.map((f) => ({ q: f.question, a: f.answer }))} />
            </section>
          ) : null}

          <section>
            <h2 className="text-xl font-bold">Reviews</h2>
            {reviews.length ? (
              <ul className="mt-4 space-y-3">
                {reviews.map((r) => (
                  <li key={r.id} className="rounded-2xl border border-line bg-white p-5">
                    <div className="flex items-center gap-1" aria-label={`${r.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }, (_, i) => <Star key={i} className={i < r.rating ? "size-4 fill-highlight-400 text-highlight-400" : "size-4 text-slate-200"} />)}
                      <span className="ml-2 text-xs text-ink-muted">Verified learner · {formatDate(r.created_at)}</span>
                    </div>
                    {r.comment ? <p className="mt-2 text-sm leading-6 text-ink-soft">{r.comment}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">No reviews yet. Only enrolled learners can review a course.</p>
            )}
            {enrolled ? <div className="mt-4"><ReviewForm courseId={course.id} slug={course.slug} existing={myReview} /></div> : null}
          </section>
        </div>

        <aside className="lg:order-2">
          <Card className="sticky top-24 overflow-hidden lg:-mt-48">
            <div className="relative aspect-[16/9] bg-brand-900">
              {course.thumbnail_url ? <Image src={course.thumbnail_url} alt="" fill className="object-cover" sizes="(min-width:1024px) 400px, 100vw" priority unoptimized={course.thumbnail_url.endsWith(".svg")} /> : null}
            </div>
            <div className="p-6">
              <PriceTag course={course} size="lg" />
              {course.effective_price < course.price_paise && course.discount_ends_at ? <p className="mt-1 text-[13px] font-medium text-red-600">Offer ends {formatDate(course.discount_ends_at)}</p> : null}
              <div className="mt-5">{cta}</div>
              {course.is_demo ? <p className="mt-3 flex items-start gap-2 text-[12.5px] text-amber-800"><TriangleAlert className="mt-0.5 size-3.5 shrink-0" />Demo listing — purchases are disabled until course content and rights are approved.</p> : null}
              <ul className="mt-6 space-y-2.5 text-sm text-ink-soft">
                <li className="flex items-center gap-2.5"><Clock className="size-4 text-ink-muted" />{formatDuration(course.duration_minutes)} of content</li>
                <li className="flex items-center gap-2.5"><BarChart3 className="size-4 text-ink-muted" />{titleCase(course.level)} level</li>
                <li className="flex items-center gap-2.5"><Globe className="size-4 text-ink-muted" />{course.language}</li>
                <li className="flex items-center gap-2.5"><Award className="size-4 text-ink-muted" />Verifiable certificate on completion</li>
                <li className="flex items-center gap-2.5"><ShieldCheck className="size-4 text-ink-muted" />Secure payment via Razorpay</li>
              </ul>
              <p className="mt-5 text-[12px] text-ink-muted">See our <Link href="/refund-policy" className="underline">refund policy</Link>.</p>
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}
