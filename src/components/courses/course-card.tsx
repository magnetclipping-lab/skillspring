import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, Layers, FolderKanban } from "lucide-react";
import type { CourseCardData } from "@/lib/data/catalogue";
import { cn, formatINR } from "@/lib/utils";
import { accentDot, accentText } from "./accent";
import { PreviewButton } from "./preview-player";

const LEVEL: Record<string, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const hours = (m: number) => `${Math.round(m / 60)} hrs`;
const shortTitle = (t: string) => t.split(" — ")[0];

function Meta({ c, className }: { c: CourseCardData; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted", className)}>
      <li className="flex items-center gap-1.5"><Clock className="size-3.5" />{hours(c.duration_minutes)}</li>
      <li className="flex items-center gap-1.5"><Layers className="size-3.5" />{c.module_count} modules</li>
      <li className="flex items-center gap-1.5"><FolderKanban className="size-3.5" />{c.projects_count ?? 0} projects</li>
    </ul>
  );
}

function Actions({ c, compact, preview = true }: { c: CourseCardData; compact?: boolean; preview?: boolean }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", compact ? "" : "pt-1")}>
      <Link href={`/checkout/${c.slug}`} className="inline-flex h-9 items-center rounded-md bg-violet-500 px-3.5 text-[13px] font-semibold text-white transition hover:bg-violet-600">Enrol now</Link>
      <Link href={`/courses/${c.slug}#curriculum`} className="inline-flex h-9 items-center rounded-md border border-line px-3.5 text-[13px] font-semibold text-ink-soft transition hover:border-white/25 hover:text-ink">View curriculum</Link>
      {preview ? <PreviewButton title={shortTitle(c.title)} src={c.preview_video_url} poster={c.preview_poster_url ?? c.thumbnail_url} className="h-9" /> : null}
    </div>
  );
}

function Thumb({ c, className, sizes }: { c: CourseCardData; className?: string; sizes: string }) {
  return (
    <div className={cn("relative overflow-hidden bg-raised", className)}>
      {c.thumbnail_url ? <Image src={c.thumbnail_url} alt="" fill className="object-cover" sizes={sizes} unoptimized={c.thumbnail_url.endsWith(".svg")} /> : null}
      <PreviewButton variant="overlay" title={shortTitle(c.title)} src={c.preview_video_url} poster={c.preview_poster_url ?? c.thumbnail_url} />
    </div>
  );
}

/** Standard grid card. */
export function CourseCard({ c, headingLevel = "h3" }: { c: CourseCardData; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition hover:border-white/15">
      <Thumb c={c} className="aspect-[16/9]" sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <p className={cn("flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em]", accentText(c.category?.accent))}>
          <span className={cn("size-1.5 rounded-full", accentDot(c.category?.accent))} />{LEVEL[c.level]}
        </p>
        <H className="font-display text-[18px] font-semibold leading-snug">
          <Link href={`/courses/${c.slug}`} className="hover:underline hover:decoration-line hover:underline-offset-4">{shortTitle(c.title)}</Link>
        </H>
        <p className="line-clamp-2 text-[14px] leading-6 text-ink-muted">{c.subtitle}</p>
        <Meta c={c} />
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4">
          <p className="font-display text-xl font-semibold">{formatINR(c.effective_price)}</p>
          <PreviewButton title={shortTitle(c.title)} src={c.preview_video_url} poster={c.preview_poster_url ?? c.thumbnail_url} />
        </div>
        <Actions c={c} preview={false} />
      </div>
    </article>
  );
}

/** Wide feature card: thumbnail beside content. Used for featured/first items. */
export function CourseFeature({ c, headingLevel = "h3" }: { c: CourseCardData; headingLevel?: "h2" | "h3" }) {
  const H = headingLevel;
  return (
    <article className="grid overflow-hidden rounded-xl border border-line bg-surface transition hover:border-white/15 md:grid-cols-[1.1fr_1fr]">
      <Thumb c={c} className="aspect-[16/9] md:aspect-auto md:min-h-[300px]" sizes="(min-width:768px) 50vw, 100vw" />
      <div className="flex flex-col gap-4 p-6 md:p-8">
        <p className={cn("kicker", accentText(c.category?.accent))}>{c.category?.name} · {LEVEL[c.level]}</p>
        <H className="font-display text-2xl font-semibold leading-tight md:text-[28px]">
          <Link href={`/courses/${c.slug}`} className="hover:underline hover:decoration-line hover:underline-offset-4">{shortTitle(c.title)}</Link>
        </H>
        <p className="text-[15px] leading-7 text-ink-soft">{c.subtitle}</p>
        <Meta c={c} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
          <p className="font-display text-2xl font-semibold">{formatINR(c.effective_price)}</p>
          <Actions c={c} compact />
        </div>
      </div>
    </article>
  );
}

/** Dense list row: no thumbnail; used in category listings and "more in this category". */
export function CourseRow({ c, index }: { c: CourseCardData; index?: number }) {
  return (
    <article className="group grid items-center gap-4 border-b border-line py-5 md:grid-cols-[48px_1fr_auto]">
      <span className="hidden font-mono text-[13px] text-ink-muted md:block">{index != null ? String(index + 1).padStart(2, "0") : ""}</span>
      <div className="min-w-0">
        <h3 className="font-display text-[17px] font-semibold">
          <Link href={`/courses/${c.slug}`} className="inline-flex items-center gap-1.5 hover:text-violet-200">{shortTitle(c.title)}<ArrowUpRight className="size-4 opacity-0 transition group-hover:opacity-100" /></Link>
        </h3>
        <p className="mt-1 line-clamp-1 text-[14px] text-ink-muted">{c.subtitle}</p>
        <Meta c={c} className="mt-2" />
      </div>
      <div className="flex flex-wrap items-center gap-3 md:justify-end">
        <span className="font-display text-lg font-semibold">{formatINR(c.effective_price)}</span>
        <Actions c={c} compact />
      </div>
    </article>
  );
}

/** Compact item for narrow columns (related courses). */
export function CourseMini({ c }: { c: CourseCardData }) {
  return (
    <article className="group border-b border-line py-4">
      <h3 className="font-display text-[15.5px] font-semibold leading-snug">
        <Link href={`/courses/${c.slug}`} className="hover:text-violet-200">{shortTitle(c.title)}</Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-muted">{c.subtitle}</p>
      <div className="mt-2 flex items-center justify-between text-[12.5px] text-ink-muted">
        <span>{LEVEL[c.level]} · {hours(c.duration_minutes)}</span>
        <span className="font-semibold text-ink">{formatINR(c.effective_price)}</span>
      </div>
    </article>
  );
}
