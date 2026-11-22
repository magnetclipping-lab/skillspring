import Image from "next/image";
import Link from "next/link";
import { Building2, CalendarClock, Clock, FlaskConical, MapPin, Star, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import type { CourseCardData } from "@/lib/data/catalogue";
import type { Internship } from "@/lib/types";
import { formatDate, formatDuration, formatINR, titleCase } from "@/lib/utils";

export function PriceTag({ course, size = "md" }: { course: Pick<CourseCardData, "price_paise" | "effective_price">; size?: "md" | "lg" }) {
  const discounted = course.effective_price < course.price_paise;
  return (
    <span className="flex items-baseline gap-2">
      <span className={size === "lg" ? "font-display text-3xl font-bold text-ink" : "font-display text-lg font-bold text-ink"}>
        {course.effective_price === 0 ? "Free" : formatINR(course.effective_price)}
      </span>
      {discounted ? <span className="text-sm text-ink-muted line-through">{formatINR(course.price_paise)}</span> : null}
    </span>
  );
}

export function CourseCard({ course, priority }: { course: CourseCardData; priority?: boolean }) {
  return (
    <Link href={`/programs/${course.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition duration-200 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="relative aspect-[16/9] overflow-hidden bg-brand-900">
        {course.thumbnail_url ? (
          <Image src={course.thumbnail_url} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition duration-300 group-hover:scale-[1.03]" priority={priority} unoptimized={course.thumbnail_url.endsWith(".svg")} />
        ) : null}
        {course.is_demo ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-ink-soft shadow-sm">Enrolment opens soon</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {course.category ? <Badge tone="brand">{course.category.name}</Badge> : null}
          <Badge>{titleCase(course.level)}</Badge>
        </div>
        <h3 className="font-display text-[17px] font-semibold leading-snug text-ink group-hover:text-brand-700">{course.title}</h3>
        {course.subtitle ? <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-ink-muted">{course.subtitle}</p> : null}
        <div className="mt-4 flex items-center gap-4 text-[12.5px] text-ink-muted">
          <span className="flex items-center gap-1"><Clock className="size-3.5" />{formatDuration(course.duration_minutes)}</span>
          <span>{course.language}</span>
          {course.review_count > 0 && course.avg_rating != null ? (
            <span className="flex items-center gap-1 text-ink-soft"><Star className="size-3.5 fill-highlight-400 text-highlight-400" />{course.avg_rating.toFixed(1)} ({course.review_count})</span>
          ) : null}
        </div>
        <div className="mt-auto flex items-end justify-between pt-5">
          <div>
            <PriceTag course={course} />
            <p className="mt-0.5 text-[12px] text-ink-muted">{course.instructor?.display_name ?? "Instructor to be announced"}</p>
          </div>
          <span className="text-sm font-semibold text-brand-600 group-hover:underline">View course →</span>
        </div>
      </div>
    </Link>
  );
}

export function InternshipKindBadge({ kind }: { kind: Internship["kind"] }) {
  if (kind === "employer") return <Badge tone="success"><Building2 className="size-3" /> Employer internship</Badge>;
  return <Badge tone="violet"><FlaskConical className="size-3" /> {kind === "simulation" ? "Educational simulation" : "Project-based experience"}</Badge>;
}

export function stipendLabel(i: Internship) {
  if (!i.is_paid) return "Unpaid";
  if (i.stipend_min_inr && i.stipend_max_inr) return `₹${i.stipend_min_inr.toLocaleString("en-IN")}–₹${i.stipend_max_inr.toLocaleString("en-IN")}/month`;
  if (i.stipend_min_inr) return `From ₹${i.stipend_min_inr.toLocaleString("en-IN")}/month`;
  return "Paid";
}

export function InternshipCard({ internship: i }: { internship: Internship }) {
  const closed = i.status !== "open" || (i.deadline && new Date(i.deadline + "T23:59:59+05:30") < new Date());
  return (
    <Link href={`/internships/${i.slug}`} className="group flex flex-col rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex flex-wrap items-center gap-1.5">
        <InternshipKindBadge kind={i.kind} />
        {closed ? <Badge tone="neutral">Closed</Badge> : null}
      </div>
      <h3 className="mt-3 font-display text-[17px] font-semibold text-ink group-hover:text-brand-700">{i.title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{i.kind === "employer" ? i.employer?.name : "Run by SkillSpring"}</p>
      <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[12.5px] text-ink-soft">
        <span className="flex items-center gap-1.5"><MapPin className="size-3.5 text-ink-muted" />{titleCase(i.work_mode)}{i.location ? ` · ${i.location}` : ""}</span>
        <span className="flex items-center gap-1.5"><Clock className="size-3.5 text-ink-muted" />{i.duration_weeks ? `${i.duration_weeks} weeks` : "Flexible"}</span>
        <span className="flex items-center gap-1.5"><Wallet className="size-3.5 text-ink-muted" />{stipendLabel(i)}</span>
        <span className="flex items-center gap-1.5"><CalendarClock className="size-3.5 text-ink-muted" />{i.deadline ? `Apply by ${formatDate(i.deadline)}` : "Rolling"}</span>
      </div>
      {i.skills.length ? (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {i.skills.slice(0, 4).map((s) => <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11.5px] font-medium text-slate-700">{s}</span>)}
        </div>
      ) : null}
    </Link>
  );
}
