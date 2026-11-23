import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ProgramWithCourse } from "@/lib/data/catalogue";
import { HUE } from "@/lib/programs";
import { cn, formatINR, titleCase } from "@/lib/utils";

export function ProgramTile({ p }: { p: ProgramWithCourse }) {
  const h = HUE[p.hue];
  return (
    <Link href={`/programs/${p.slug}`} className={cn("card card-hover group relative flex flex-col overflow-hidden p-7 sm:p-9")}>
      <div className={cn("pointer-events-none absolute -right-20 -top-20 size-72 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60", h.solid)} aria-hidden />
      <div className="relative flex items-center justify-between gap-3">
        <span className={cn("flex items-center gap-2 text-[14px] font-semibold", h.text)}><span className={cn("size-2.5 rounded-full", h.dot)} />{p.course?.category?.name ?? p.shortName}</span>
        {p.course?.is_demo ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] font-semibold text-ink-soft">Enrolment opens soon</span> : null}
      </div>
      <h3 className="display relative mt-8 text-[34px] text-sheen sm:text-[40px]">{p.name}</h3>
      <p className="relative mt-3 max-w-md text-[16px] leading-7 text-ink-soft">{p.course?.subtitle ?? p.pitch}</p>
      <div className="relative mt-auto flex flex-wrap items-end justify-between gap-4 pt-10">
        <dl className="flex gap-6 text-[14px]">
          <div><dt className="text-ink-muted">Duration</dt><dd className="font-semibold text-ink">{p.duration}</dd></div>
          <div><dt className="text-ink-muted">Level</dt><dd className="font-semibold text-ink">{p.course ? titleCase(p.course.level) : "Beginner"}</dd></div>
          <div><dt className="text-ink-muted">Projects</dt><dd className="font-semibold text-ink">{p.projects.length}</dd></div>
        </dl>
        <div className="flex items-center gap-3">
          <span className="font-display text-[30px] font-bold tracking-tight text-ink">{p.course ? formatINR(p.course.effective_price) : ""}</span>
          <span className="grid size-11 place-items-center rounded-full bg-ink text-canvas transition-transform group-hover:rotate-45"><ArrowUpRight className="size-5" /></span>
        </div>
      </div>
    </Link>
  );
}
