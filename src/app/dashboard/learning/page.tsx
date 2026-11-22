import Image from "next/image";
import Link from "next/link";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getMyCourses } from "@/lib/data/student";
import { Badge, EmptyState, PageHeader, Progress } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, formatDuration } from "@/lib/utils";

export const metadata = { title: "My learning" };

export default async function MyLearningPage() {
  const user = await requireUser("/dashboard/learning");
  const courses = await getMyCourses(user.id);
  return (
    <>
      <PageHeader title="My learning" description="Courses you're enrolled in." />
      {courses.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <Link key={c.enrolment_id} href={`/dashboard/learning/${c.course.slug}`} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition hover:shadow-lift">
              <div className="relative aspect-[16/9] bg-brand-900">
                {c.course.thumbnail_url ? <Image src={c.course.thumbnail_url} alt="" fill className="object-cover" sizes="(min-width:1024px) 33vw, 50vw" unoptimized={c.course.thumbnail_url.endsWith(".svg")} /> : null}
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display font-semibold group-hover:text-brand-700">{c.course.title}</p>
                  {c.completed_at ? <Badge tone="success"><CheckCircle2 className="size-3" />Completed</Badge> : null}
                </div>
                <p className="mt-1 text-[12.5px] text-ink-muted">{formatDuration(c.course.duration_minutes)} · Enrolled {formatDate(c.enrolled_at)}</p>
                <div className="mt-4 flex items-center gap-3"><Progress value={c.percent} /><span className="text-[13px] font-semibold">{c.percent}%</span></div>
                <p className="mt-2 text-[12.5px] text-ink-muted">{c.completed} of {c.total} lessons complete</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState icon={<BookOpen className="size-5" />} title="You haven't enrolled in any courses yet" description="Find a course that fits your goals." action={<ButtonLink href="/programs">Explore programs</ButtonLink>} />
      )}
    </>
  );
}
