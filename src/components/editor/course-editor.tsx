import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3, ClipboardList, Eye, FileText, Globe, Send, Trash2, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { deleteModuleAction, submitForReviewAction } from "@/lib/actions/course-content";
import { Alert, Badge, type BadgeTone, Card, CardHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form";
import { CourseForm, ModuleForm, NewLessonForm } from "./forms";
import { titleCase } from "@/lib/utils";
import type { Category, Course, Lesson, LessonType } from "@/lib/types";

const lessonIcon: Record<LessonType, typeof Video> = { video: Video, text: FileText, pdf: FileText, external: Globe, assignment: ClipboardList, quiz: BarChart3 };
export const statusTone: Record<string, BadgeTone> = { draft: "neutral", pending_review: "warning", changes_requested: "danger", approved: "brand", published: "success", archived: "neutral" };

export async function loadCourseForEditor(courseId: string) {
  if (!/^[0-9a-f-]{36}$/.test(courseId)) notFound();
  const supabase = await createClient();
  const [{ data: course }, { data: categories }, { data: modules }, { data: lessons }] = await Promise.all([
    supabase.from("courses").select("*").eq("id", courseId).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("course_modules").select("id, title, position, created_at").eq("course_id", courseId).order("position").order("created_at"),
    supabase.from("lessons").select("*").eq("course_id", courseId).order("position").order("created_at"),
  ]);
  if (!course) notFound();
  return { course: course as Course, categories: (categories ?? []) as Category[], modules: modules ?? [], lessons: (lessons ?? []) as Lesson[] };
}

export function CourseEditorView({ base, data, editable, notice, adminPanel }: {
  base: "/admin" | "/instructor"; data: Awaited<ReturnType<typeof loadCourseForEditor>>; editable: boolean; notice?: React.ReactNode; adminPanel?: React.ReactNode;
}) {
  const { course, categories, modules, lessons } = data;
  return (
    <div className="space-y-6">
      <Link href={`${base}/courses`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" />All courses</Link>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap gap-2"><Badge tone={statusTone[course.status]}>{titleCase(course.status)}</Badge><Badge tone={course.rights_status === "rejected" ? "danger" : course.rights_status === "pending" ? "warning" : "success"}>Rights: {titleCase(course.rights_status)}</Badge>{course.is_demo ? <Badge tone="warning">Demo</Badge> : null}</div>
          <h1 className="mt-2 text-2xl font-bold">{course.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {course.status === "published" ? <Link href={`/programs/${course.slug}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-brand-50"><Eye className="size-4" />View live</Link> : null}
          <Link href={`${base}/courses/${course.id}/submissions`} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-brand-50"><ClipboardList className="size-4" />Submissions</Link>
          {base === "/instructor" && editable ? (
            <form action={submitForReviewAction}><input type="hidden" name="_base" value={base} /><input type="hidden" name="course_id" value={course.id} /><SubmitButton pendingText="Submitting…"><Send className="size-4" />Submit for review</SubmitButton></form>
          ) : null}
        </div>
      </div>
      {notice}
      {course.review_notes && course.status === "changes_requested" ? <Alert tone="warning" title="Changes requested by reviewer">{course.review_notes}</Alert> : null}
      {!editable ? <Alert tone="info">This course is {titleCase(course.status).toLowerCase()} and is locked for editing{base === "/instructor" ? " until the review is complete" : ""}.</Alert> : null}
      {adminPanel}

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card><CardHeader title="Course details" /><div className="p-5"><CourseForm base={base} categories={categories} course={course} readOnly={!editable} /></div></Card>
        <Card>
          <CardHeader title="Curriculum" description={`${modules.length} modules · ${lessons.length} lessons`} />
          <div className="space-y-5 p-5">
            {modules.map((m) => {
              const ls = lessons.filter((l) => l.module_id === m.id);
              return (
                <div key={m.id} className="rounded-xl border border-line">
                  <div className="flex items-center gap-2 border-b border-line bg-slate-50/60 p-3">
                    <div className="flex-1">{editable ? <ModuleForm base={base} courseId={course.id} module={m} /> : <p className="font-semibold">{m.title}</p>}</div>
                    {editable ? <form action={deleteModuleAction}><input type="hidden" name="_base" value={base} /><input type="hidden" name="course_id" value={course.id} /><input type="hidden" name="id" value={m.id} /><button className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label={`Delete module ${m.title}`}><Trash2 className="size-4" /></button></form> : null}
                  </div>
                  <ul className="divide-y divide-line">
                    {ls.map((l) => {
                      const Icon = lessonIcon[l.type];
                      return (
                        <li key={l.id}>
                          <Link href={`${base}/courses/${course.id}/lessons/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-brand-50/40">
                            <Icon className="size-4 text-ink-muted" /><span className="flex-1">{l.title}</span>
                            {l.is_preview ? <Badge tone="brand">Preview</Badge> : null}
                            {l.type === "video" && !l.video_asset_id ? <Badge tone="warning">No video</Badge> : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                  {editable ? <div className="border-t border-line p-3"><NewLessonForm base={base} courseId={course.id} moduleId={m.id} nextPosition={ls.length + 1} /></div> : null}
                </div>
              );
            })}
            {editable ? <div><p className="mb-2 text-sm font-semibold">Add a module</p><ModuleForm base={base} courseId={course.id} nextPosition={modules.length + 1} /></div> : null}
            {!modules.length && !editable ? <p className="text-sm text-ink-muted">No modules yet.</p> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
