import type { Metadata } from "next";
import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { CourseCard } from "@/components/site/cards";
import { AutoSubmitForm } from "@/components/site/auto-submit-form";
import { Button } from "@/components/ui/button";
import { EmptyState, Input, Select } from "@/components/ui/primitives";
import { getCategories, getPublishedCourses } from "@/lib/data/catalogue";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Courses",
  description: "Browse practical courses in finance, stock markets, AI, marketing and career development.",
  alternates: { canonical: "/courses" },
};

type SP = Promise<{ q?: string; category?: string; level?: string; price?: string; sort?: string }>;

export default async function CoursesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = { q: sp.q?.slice(0, 80), category: sp.category, level: sp.level, price: sp.price, sort: sp.sort };
  const [courses, categories] = await Promise.all([getPublishedCourses(q), getCategories()]);
  const params = (patch: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    Object.entries({ ...q, ...patch }).forEach(([k, v]) => v && u.set(k, v));
    const s = u.toString();
    return s ? `/courses?${s}` : "/courses";
  };

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="eyebrow">Course catalogue</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Explore courses</h1>
        <p className="mt-2 text-ink-muted">Practical, affordable courses designed around real work.</p>
      </div>

      <AutoSubmitForm action="/courses" className="mt-8 grid gap-3 rounded-2xl border border-line bg-white p-3 shadow-soft md:grid-cols-[1.6fr_repeat(4,1fr)_auto]" role="search">
        <label className="relative">
          <span className="sr-only">Search courses</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input name="q" defaultValue={q.q} placeholder="Search courses…" className="pl-9" />
        </label>
        <label><span className="sr-only">Category</span>
          <Select name="category" defaultValue={q.category ?? ""}>
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </Select>
        </label>
        <label><span className="sr-only">Level</span>
          <Select name="level" defaultValue={q.level ?? ""}>
            <option value="">All levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </Select>
        </label>
        <label><span className="sr-only">Price</span>
          <Select name="price" defaultValue={q.price ?? ""}>
            <option value="">Any price</option>
            <option value="free">Free</option>
            <option value="under-500">Under ₹500</option>
            <option value="500-1000">₹500 – ₹1,000</option>
            <option value="over-1000">Over ₹1,000</option>
          </Select>
        </label>
        <label><span className="sr-only">Sort by</span>
          <Select name="sort" defaultValue={q.sort ?? "popular"}>
            <option value="popular">Most popular</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </Select>
        </label>
        <Button type="submit">Apply</Button>
      </AutoSubmitForm>

      <div className="mt-5 flex flex-wrap gap-2" aria-label="Quick category filters">
        <Link href={params({ category: undefined })} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition", !q.category ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-soft ring-line hover:ring-brand-300")}>All</Link>
        {categories.map((c) => (
          <Link key={c.id} href={params({ category: c.slug })} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-medium ring-1 ring-inset transition", q.category === c.slug ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-ink-soft ring-line hover:ring-brand-300")}>{c.name}</Link>
        ))}
      </div>

      <p className="mt-6 text-sm text-ink-muted" aria-live="polite">{courses.length} {courses.length === 1 ? "course" : "courses"}{q.q ? <> matching “{q.q}”</> : null}</p>

      {courses.length ? (
        <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c, i) => <CourseCard key={c.id} course={c} priority={i < 3} />)}
        </div>
      ) : (
        <EmptyState className="mt-6" icon={<SearchX className="size-5" />} title="No courses match your filters" description="Try a different search term or clear the filters." action={<Link href="/courses" className="text-sm font-semibold text-brand-600 hover:underline">Clear filters</Link>} />
      )}
    </div>
  );
}
