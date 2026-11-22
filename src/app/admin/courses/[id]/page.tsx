import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CourseEditorView, loadCourseForEditor } from "@/components/editor/course-editor";
import { adminCourseSettingsAction, adminDeleteCourseAction, adminPublishCourseAction, adminReviewCourseAction, adminSetCourseShareAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Alert, Card, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { titleCase } from "@/lib/utils";

export default async function AdminCourseEditor({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireAdmin();
  const data = await loadCourseForEditor(id);
  const c = data.course;
  const supabase = await createClient();
  const [{ data: instructors }, { data: share }] = await Promise.all([
    supabase.from("instructor_profiles").select("id, display_name").eq("status", "approved").order("display_name"),
    supabase.from("instructor_revenue_shares").select("share_pct").eq("course_id", c.id).is("effective_to", null).maybeSingle(),
  ]);
  const hidden = <input type="hidden" name="course_id" value={c.id} />;

  const panel = (
    <Card>
      <CardHeader title="Review & publishing" description="Administrator controls" />
      <div className="grid gap-6 p-5 lg:grid-cols-3">
        <div className="space-y-3">
          <p className="text-sm font-semibold">1. Review decision</p>
          <form action={adminReviewCourseAction} className="space-y-2">
            {hidden}
            <Textarea name="notes" rows={2} placeholder="Notes for the instructor (required for change requests)" defaultValue={c.review_notes ?? ""} className="min-h-0" />
            <div className="flex flex-wrap gap-2">
              <button name="decision" value="approve" className="h-9 rounded-lg bg-emerald-600 px-3 text-[13px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-40" disabled={!["pending_review", "draft", "changes_requested"].includes(c.status)}>Approve</button>
              <button name="decision" value="request_changes" className="h-9 rounded-lg bg-amber-500 px-3 text-[13px] font-semibold text-white hover:bg-amber-600 disabled:opacity-40" disabled={!["pending_review", "draft"].includes(c.status)}>Request changes</button>
              <button name="decision" value="archive" className="h-9 rounded-lg px-3 text-[13px] font-semibold text-ink-soft ring-1 ring-line hover:bg-slate-50">Archive</button>
            </div>
          </form>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold">2. Publish</p>
          <p className="text-[13px] text-ink-muted">Status: <strong>{titleCase(c.status)}</strong>. Purchases also require cleared content rights and non-demo status.</p>
          <form action={adminPublishCourseAction}>{hidden}<input type="hidden" name="publish" value={c.status === "published" ? "false" : "true"} /><SubmitButton variant={c.status === "published" ? "secondary" : "primary"} disabled={!["approved", "published"].includes(c.status)}>{c.status === "published" ? "Unpublish" : "Publish course"}</SubmitButton></form>
        </div>
        <ActionForm action={adminCourseSettingsAction} className="space-y-3" compact>
          <p className="text-sm font-semibold">3. Rights, ownership & demo flag</p>
          {hidden}
          <Field label="Commercial content rights" name="rights_status"><Select id="rights_status" name="rights_status" defaultValue={c.rights_status}>{["pending", "owned", "licensed", "instructor_owned", "rejected"].map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</Select></Field>
          <Input name="rights_notes" placeholder="Rights evidence / agreement reference" defaultValue={c.rights_notes ?? ""} />
          <Field label="Instructor" name="instructor_id"><Select id="instructor_id" name="instructor_id" defaultValue={c.instructor_id ?? ""}><option value="">— None —</option>{(instructors ?? []).map((i) => <option key={i.id} value={i.id}>{i.display_name}</option>)}</Select></Field>
          <Checkbox name="is_demo" defaultChecked={c.is_demo} label="Demo listing (never purchasable)" />
          <SubmitButton variant="secondary" size="sm">Save settings</SubmitButton>
        </ActionForm>
      </div>
      {c.instructor_id ? (
        <div className="border-t border-line p-5">
          <ActionForm action={adminSetCourseShareAction} className="flex flex-wrap items-end gap-3" compact>
            {hidden}<input type="hidden" name="instructor_id" value={c.instructor_id} />
            <Field label="Instructor revenue share for this course (%)" name="share_pct" help={share ? `Current: ${Number(share.share_pct)}%` : "Falls back to the instructor's default share"}><Input id="share_pct" name="share_pct" type="number" min={0} max={100} step="0.5" defaultValue={share ? Number(share.share_pct) : ""} className="w-40" /></Field>
            <SubmitButton variant="secondary" size="md">Set share</SubmitButton>
          </ActionForm>
        </div>
      ) : null}
      <div className="flex justify-end border-t border-line p-4">
        <form action={adminDeleteCourseAction}>{hidden}<button className="text-[13px] font-semibold text-red-600 hover:underline">Delete course (archives if it has sales)</button></form>
      </div>
    </Card>
  );
  const doneText: Record<string, string> = { approve: "approved", request_changes: "sent back to the instructor for changes", archive: "archived", archived: "archived", published: "published", unpublished: "unpublished" };
  const notice = sp.error ? <Alert tone="danger">{sp.error}</Alert> : sp.done && doneText[sp.done] ? <Alert tone="success">Course {doneText[sp.done]}.</Alert> : null;
  return <CourseEditorView base="/admin" data={data} editable notice={notice} adminPanel={panel} />;
}
