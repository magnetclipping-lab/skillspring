import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { ProgramTile } from "@/components/programs/program-tile";
import { CourseCard } from "@/components/site/cards";
import { getPrograms, getPublishedCourses } from "@/lib/data/catalogue";
import { HUE } from "@/lib/programs";
import { cn, formatINR, titleCase } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Programs",
  description: "Stock Market, Web Design & Development, Digital Marketing and Excel programs for students across India.",
  alternates: { canonical: "/programs" },
};

export default async function ProgramsPage() {
  const [programs, allCourses] = await Promise.all([getPrograms(), getPublishedCourses({ sort: "newest" })]);
  const programSlugs = new Set(programs.map((p) => p.slug));
  const extra = allCourses.filter((c) => !programSlugs.has(c.slug));
  const rows: { label: string; value: (p: (typeof programs)[number]) => React.ReactNode }[] = [
    { label: "Price", value: (p) => <span className="font-display text-[20px] font-bold">{p.course ? formatINR(p.course.effective_price) : ""}</span> },
    { label: "Duration", value: (p) => p.duration },
    { label: "Time per week", value: (p) => p.weeklyEffort },
    { label: "Level", value: (p) => (p.course ? titleCase(p.course.level) : "Beginner") },
    { label: "Projects", value: (p) => `${p.projects.length} projects, including a capstone` },
    { label: "Certificate", value: () => <Check className="size-5 text-stock" strokeWidth={2.5} aria-label="Included" /> },
    { label: "Good for", value: (p) => p.careers.slice(0, 2).join(", ") },
  ];

  return (
    <div className="pb-24">
      <section className="container-page pt-14 sm:pt-20">
        <h1 className="display max-w-3xl text-[56px] sm:text-[80px]">Programs</h1>
        <p className="mt-5 max-w-2xl text-[18px] leading-8 text-ink-soft">
          Four focused programs, each with video lessons, practice files, quizzes, real projects and a verifiable certificate. Pay once, learn at your own pace.
        </p>
      </section>

      <section className="container-page mt-12 grid gap-5 lg:grid-cols-2">
        {programs.map((p) => <ProgramTile key={p.slug} p={p} />)}
      </section>

      <section className="container-page mt-24" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="display text-[40px] sm:text-[48px]">Compare programs</h2>
        <div className="mt-8 overflow-x-auto rounded-[28px] bg-surface ring-1 ring-ink/8">
          <table className="w-full min-w-[820px] text-left text-[15px]">
            <thead>
              <tr>
                <th className="w-44 px-6 py-5" />
                {programs.map((p) => (
                  <th key={p.slug} scope="col" className="px-5 py-5 align-bottom">
                    <span className={cn("mb-2 block h-1.5 w-10 rounded-full", HUE[p.hue].solid)} />
                    <Link href={`/programs/${p.slug}`} className="font-display text-[18px] font-semibold text-ink hover:text-white">{p.shortName}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-ink/8">
                  <th scope="row" className="px-6 py-4 font-medium text-ink-muted">{r.label}</th>
                  {programs.map((p) => <td key={p.slug} className="px-5 py-4 text-ink">{r.value(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {extra.length ? (
        <section className="container-page mt-24" aria-labelledby="more-heading">
          <h2 id="more-heading" className="display text-[40px] sm:text-[48px]">More courses</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {extra.map((c) => <CourseCard key={c.id} course={c} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
