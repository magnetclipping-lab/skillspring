import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { getCategories, getPublishedCourses } from "@/lib/data/catalogue";
import { CourseCard, CourseFeature, CourseRow } from "@/components/courses/course-card";
import { accentDot } from "@/components/courses/accent";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Courses",
  description: "24 practical courses in AI & automation, digital marketing, professional tools and business. ₹7,500 per course, with graded assignments.",
  alternates: { canonical: "/courses" },
};

type Props = { searchParams: Promise<{ category?: string; level?: string; q?: string; view?: string }> };

const LEVELS = [["", "All levels"], ["beginner", "Beginner"], ["intermediate", "Intermediate"], ["advanced", "Advanced"]] as const;

export default async function CoursesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const [categories, courses] = await Promise.all([getCategories(), getPublishedCourses({ category: sp.category, level: sp.level, q: sp.q })]);
  const active = categories.find((c) => c.slug === sp.category);
  const view = sp.view === "list" ? "list" : "grid";
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { category: sp.category, level: sp.level, q: sp.q, view: sp.view, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/courses?${s}` : "/courses";
  };
  const groups = active || sp.q || sp.level ? null : categories.map((c) => ({ cat: c, list: courses.filter((x) => x.category?.slug === c.slug) }));

  return (
    <main id="main">
      <section className="border-b border-line">
        <div className="container-page pb-10 pt-14">
          <p className="eyebrow">{active ? active.name : "All courses"}</p>
          <h1 className="display mt-4 text-[46px] sm:text-[64px]">{active ? active.name : "Courses"}</h1>
          <p className="mt-4 max-w-2xl text-[17px] leading-7 text-ink-soft">
            {active?.tagline ?? "Practical courses with graded assignments and rubric-based feedback. Every course is ₹7,500, one-time."}
          </p>
          <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Categories" className="-mx-1 flex gap-1 overflow-x-auto pb-1">
              <Link href={qs({ category: undefined })} aria-current={!active ? "page" : undefined} className={cn("shrink-0 rounded-md px-3.5 py-2 text-[14px] font-medium", !active ? "bg-raised text-ink" : "text-ink-soft hover:text-ink")}>All</Link>
              {categories.map((c) => (
                <Link key={c.slug} href={qs({ category: c.slug })} aria-current={active?.slug === c.slug ? "page" : undefined} className={cn("flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-[14px] font-medium", active?.slug === c.slug ? "bg-raised text-ink" : "text-ink-soft hover:text-ink")}>
                  <span className={cn("size-1.5 rounded-full", accentDot(c.accent))} />{c.name}
                </Link>
              ))}
            </nav>
            <form className="flex flex-wrap items-center gap-2" action="/courses">
              {sp.category ? <input type="hidden" name="category" value={sp.category} /> : null}
              <label className="relative">
                <span className="sr-only">Search courses</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input name="q" defaultValue={sp.q} placeholder="Search courses" className="h-10 w-56 rounded-md border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-violet-500" />
              </label>
              <label>
                <span className="sr-only">Level</span>
                <select name="level" defaultValue={sp.level ?? ""} className="h-10 rounded-md border border-line bg-surface px-3 text-sm">
                  {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <button className="h-10 rounded-md border border-line px-3.5 text-sm font-medium text-ink-soft hover:text-ink">Apply</button>
              <div className="ml-1 flex rounded-md border border-line p-0.5 text-[13px]" role="group" aria-label="Layout">
                <Link href={qs({ view: undefined })} aria-pressed={view === "grid"} className={cn("rounded px-2.5 py-1.5", view === "grid" ? "bg-raised text-ink" : "text-ink-muted")}>Grid</Link>
                <Link href={qs({ view: "list" })} aria-pressed={view === "list"} className={cn("rounded px-2.5 py-1.5", view === "list" ? "bg-raised text-ink" : "text-ink-muted")}>List</Link>
              </div>
            </form>
          </div>
        </div>
      </section>

      <div className="container-page py-14">
        {!courses.length ? (
          <div className="rounded-xl border border-line p-10 text-center">
            <p className="font-display text-lg font-semibold">No courses match</p>
            <p className="mt-2 text-sm text-ink-muted">Try a different search or <Link className="text-violet-300 hover:underline" href="/courses">clear the filters</Link>.</p>
          </div>
        ) : groups ? (
          <div className="space-y-20">
            {groups.filter((g) => g.list.length).map(({ cat, list }) => (
              <section key={cat.slug} aria-labelledby={`cat-${cat.slug}`}>
                <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <h2 id={`cat-${cat.slug}`} className="flex items-center gap-2.5 font-display text-2xl font-semibold"><span className={cn("size-2 rounded-full", accentDot(cat.accent))} />{cat.name}</h2>
                    {cat.tagline ? <p className="mt-1 text-[14px] text-ink-muted">{cat.tagline}</p> : null}
                  </div>
                  <Link href={qs({ category: cat.slug })} className="shrink-0 text-[13.5px] font-semibold text-violet-300 hover:text-violet-200">{list.length} courses →</Link>
                </div>
                {view === "list" ? (
                  <div>{list.map((c, i) => <CourseRow key={c.id} c={c} index={i} />)}</div>
                ) : (
                  <div className="mt-8 space-y-6">
                    <CourseFeature c={list[0]} />
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{list.slice(1).map((c) => <CourseCard key={c.id} c={c} />)}</div>
                  </div>
                )}
              </section>
            ))}
          </div>
        ) : view === "list" ? (
          <div className="border-t border-line">{courses.map((c, i) => <CourseRow key={c.id} c={c} index={i} />)}</div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{courses.map((c) => <CourseCard key={c.id} c={c} headingLevel="h2" />)}</div>
        )}
        <p className="mt-16 text-[13px] text-ink-muted">Showing {courses.length} course{courses.length === 1 ? "" : "s"}. Prices in INR.</p>
      </div>
    </main>
  );
}
