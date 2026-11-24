import { Download, ExternalLink, FolderOpen } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getMyAssignments } from "@/lib/data/assessment";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Resources" };

export default async function ResourcesPage() {
  const user = await requireUser("/dashboard/resources");
  const supabase = await createClient();
  const [assignments, { data: enr }] = await Promise.all([
    getMyAssignments(user.id),
    supabase.from("enrolments").select("course_id, course:courses(slug, title)").eq("user_id", user.id).eq("status", "active"),
  ]);
  const courses = ((enr ?? []) as unknown as { course_id: string; course: { slug: string; title: string } }[]);
  const { data: resources } = courses.length
    ? await supabase.from("lesson_resources").select("id, title, kind, course_id").in("course_id", courses.map((c) => c.course_id)).order("created_at")
    : { data: [] };
  const groups = courses.map((c) => ({
    c,
    templates: assignments.filter((a) => a.assignment.course_id === c.course_id && a.assignment.has_template),
    files: (resources ?? []).filter((r) => r.course_id === c.course_id),
  })).filter((g) => g.templates.length || g.files.length);

  return (
    <>
      <PageHeader eyebrow="Learning" title="Resources" description="Workbooks, briefs and files from your enrolled courses." />
      {!groups.length ? (
        <EmptyState icon={<FolderOpen className="size-5" />} title="No resources yet" description="Assignment workbooks, Word briefs and lesson files from your courses appear here." action={<ButtonLink href="/courses">Browse courses</ButtonLink>} />
      ) : (
        <div className="space-y-8">
          {groups.map(({ c, templates, files }) => (
            <section key={c.course_id} aria-labelledby={`r-${c.course_id}`}>
              <h2 id={`r-${c.course_id}`} className="mb-3 font-display text-lg font-semibold">{c.course.title.split(" — ")[0]}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                {templates.map((a) => (
                  <li key={a.assignment.id}>
                    <a href={`/api/templates/${a.assignment.id}`} className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-white/[0.02]">
                      <Download className="size-4 text-violet-300" />
                      <span className="flex-1"><span className="font-medium">{a.assignment.template_name}</span><span className="ml-2 text-ink-muted">for {a.assignment.title}</span></span>
                    </a>
                  </li>
                ))}
                {files.map((r) => (
                  <li key={r.id}>
                    <a href={`/api/resources/${r.id}`} className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-white/[0.02]">
                      {r.kind === "link" ? <ExternalLink className="size-4 text-cyan-400" /> : <Download className="size-4 text-cyan-400" />}
                      <span className="flex-1 font-medium">{r.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
