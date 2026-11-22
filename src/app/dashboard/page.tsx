import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, ClipboardList, PlayCircle, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getMyCourses } from "@/lib/data/student";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, CardHeader, EmptyState, Progress, StatCard } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, titleCase } from "@/lib/utils";

export default async function DashboardHome({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser();
  const supabase = await createClient();
  const [courses, { count: certCount }, { data: apps }, { data: notes }] = await Promise.all([
    getMyCourses(user.id),
    supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "valid"),
    supabase.from("internship_applications").select("id, status, created_at, internship:internships(title, slug)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(4),
    supabase.from("notifications").select("id, title, body, link, created_at, read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
  ]);
  const resume = courses.find((c) => c.last_lesson_id && c.percent < 100) ?? courses.find((c) => c.percent < 100);
  const p = user.profile;
  const profileFields = [p.full_name, p.phone, p.college, p.degree, p.graduation_year, p.skills.length ? "x" : null];
  const completeness = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const firstName = (p.full_name || "there").split(" ")[0];

  return (
    <div className="space-y-6">
      {sp.password === "updated" ? <Alert tone="success">Your password has been updated.</Alert> : null}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-bold sm:text-[28px]">Welcome back, {firstName} 👋</h1>
          <p className="mt-1 text-sm text-ink-muted">Here&apos;s where you left off.</p>
        </div>
        <ButtonLink href="/courses" variant="secondary">Browse courses</ButtonLink>
      </div>

      {resume ? (
        <Card className="overflow-hidden">
          <div className="grid gap-0 sm:grid-cols-[220px_1fr]">
            <div className="relative aspect-[16/9] bg-brand-900 sm:aspect-auto">
              {resume.course.thumbnail_url ? <Image src={resume.course.thumbnail_url} alt="" fill className="object-cover" sizes="220px" unoptimized={resume.course.thumbnail_url.endsWith(".svg")} /> : null}
            </div>
            <div className="p-5">
              <p className="eyebrow">Continue learning</p>
              <p className="mt-1 font-display text-lg font-semibold">{resume.course.title}</p>
              {resume.lastLessonTitle ? <p className="mt-0.5 text-sm text-ink-muted">Last viewed: {resume.lastLessonTitle}</p> : null}
              <div className="mt-4 flex items-center gap-3"><Progress value={resume.percent} className="max-w-xs" /><span className="text-sm font-semibold">{resume.percent}%</span></div>
              <ButtonLink className="mt-4" href={resume.last_lesson_id ? `/learn/${resume.course.slug}/${resume.last_lesson_id}` : `/dashboard/learning/${resume.course.slug}`}><PlayCircle className="size-4" />Resume</ButtonLink>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Enrolled courses" value={courses.length} icon={<BookOpen className="size-4" />} />
        <StatCard label="Completed" value={courses.filter((c) => c.completed_at).length} icon={<Award className="size-4" />} />
        <StatCard label="Certificates" value={certCount ?? 0} icon={<Award className="size-4" />} />
        <StatCard label="Applications" value={apps?.length ?? 0} icon={<ClipboardList className="size-4" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="My courses" action={<Link href="/dashboard/learning" className="text-sm font-semibold text-brand-600 hover:underline">View all</Link>} />
          {courses.length ? (
            <ul className="divide-y divide-line">
              {courses.slice(0, 5).map((c) => (
                <li key={c.enrolment_id}>
                  <Link href={`/dashboard/learning/${c.course.slug}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{c.course.title}</p>
                      <div className="mt-2 flex items-center gap-3"><Progress value={c.percent} /><span className="w-10 text-right text-[13px] font-semibold text-ink-soft">{c.percent}%</span></div>
                    </div>
                    <ArrowRight className="size-4 text-ink-muted" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5"><EmptyState icon={<BookOpen className="size-5" />} title="No courses yet" description="Courses you purchase or enrol in will appear here." action={<ButtonLink href="/courses">Explore courses</ButtonLink>} /></div>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><UserRound className="size-5" /></span>
              <div className="min-w-0"><p className="truncate font-semibold">{p.full_name || "Your profile"}</p><p className="truncate text-[13px] text-ink-muted">{[p.degree, p.college].filter(Boolean).join(" · ") || user.email}</p></div>
            </div>
            <div className="mt-4"><div className="mb-1.5 flex justify-between text-[12.5px] text-ink-muted"><span>Profile completeness</span><span className="font-semibold text-ink">{completeness}%</span></div><Progress value={completeness} /></div>
            {completeness < 100 ? <Link href="/dashboard/settings" className="mt-3 inline-block text-[13px] font-semibold text-brand-600 hover:underline">Complete your profile →</Link> : null}
          </Card>

          <Card>
            <CardHeader title="Recent applications" action={<Link href="/dashboard/applications" className="text-sm font-semibold text-brand-600 hover:underline">All</Link>} />
            {apps?.length ? (
              <ul className="divide-y divide-line">
                {(apps as unknown as { id: string; status: string; created_at: string; internship: { title: string; slug: string } | null }[]).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 truncate">{a.internship?.title}</span>
                    <Badge tone={a.status === "selected" ? "success" : a.status === "rejected" ? "danger" : "brand"}>{titleCase(a.status)}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-4 text-sm text-ink-muted">No applications yet. <Link href="/internships" className="font-semibold text-brand-600 hover:underline">Browse opportunities</Link></p>}
          </Card>

          <Card>
            <CardHeader title="Notifications" action={<Link href="/dashboard/notifications" className="text-sm font-semibold text-brand-600 hover:underline">All</Link>} />
            {notes?.length ? (
              <ul className="divide-y divide-line">
                {notes.map((n) => (
                  <li key={n.id} className="px-5 py-3">
                    <p className="flex items-center gap-2 text-sm font-medium">{!n.read_at ? <span className="size-1.5 rounded-full bg-brand-600" /> : null}{n.title}</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">{formatDate(n.created_at)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-4 text-sm text-ink-muted">You&apos;re all caught up.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
