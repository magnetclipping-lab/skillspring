import Link from "next/link";
import { ArrowLeft, Paperclip } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, Table } from "@/components/ui/primitives";
import { formatDate, titleCase } from "@/lib/utils";
import { ReviewSubmissionForm } from "./review-form";

/** Assignment submissions for a course. RLS limits rows to the course's instructor and admins. */
export async function SubmissionsView({ base, courseId }: { base: "/admin" | "/instructor"; courseId: string }) {
  const supabase = await createClient();
  const [{ data: course }, { data: subs }] = await Promise.all([
    supabase.from("courses").select("title").eq("id", courseId).maybeSingle(),
    supabase.from("assignment_submissions").select("id, status, text_response, file_path, feedback, created_at, updated_at, user_id, assignment:assignments(title)").eq("course_id", courseId).order("updated_at", { ascending: false }),
  ]);
  type Row = { id: string; status: string; text_response: string | null; file_path: string | null; feedback: string | null; updated_at: string; user_id: string; assignment: { title: string } | null };
  const rows = (subs ?? []) as unknown as Row[];
  return (
    <div className="space-y-6">
      <Link href={`${base}/courses/${courseId}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:underline"><ArrowLeft className="size-4" />{course?.title ?? "Course"}</Link>
      <h1 className="text-2xl font-bold">Assignment submissions</h1>
      {rows.length ? (
        <Table>
          <thead><tr><th>Assignment</th><th>Learner</th><th>Submission</th><th>Status</th><th>Review</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="align-top">
                <td className="font-medium">{s.assignment?.title}<p className="text-[12px] font-normal text-ink-muted">{formatDate(s.updated_at)}</p></td>
                <td className="font-mono text-[12px] text-ink-muted">{s.user_id.slice(0, 8)}</td>
                <td className="max-w-sm">
                  {s.text_response ? <p className="line-clamp-4 whitespace-pre-line text-[13px]">{s.text_response}</p> : null}
                  {s.file_path ? <a href={`/api/files?type=submission&id=${s.id}`} className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-brand-300 hover:underline"><Paperclip className="size-3.5" />Download file</a> : null}
                </td>
                <td><Badge tone={s.status === "approved" ? "success" : s.status === "needs_revision" ? "warning" : "brand"}>{titleCase(s.status)}</Badge></td>
                <td className="min-w-64"><ReviewSubmissionForm base={base} courseId={courseId} id={s.id} status={s.status} feedback={s.feedback} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : <EmptyState title="No submissions yet" />}
    </div>
  );
}
