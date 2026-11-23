import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { adminReviewInstructorAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Badge, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui/primitives";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Instructors" };

export default async function AdminInstructors() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: earnings }, { data: courses }] = await Promise.all([
    supabase.from("instructor_profiles").select("*, profile:profiles(email)").order("status").order("created_at", { ascending: false }),
    supabase.from("instructor_earnings").select("instructor_id, amount_paise"),
    supabase.from("courses").select("instructor_id, title, status").not("instructor_id", "is", null),
  ]);
  type Row = { id: string; user_id: string; display_name: string; headline: string | null; bio: string | null; expertise: string[]; website: string | null; linkedin_url: string | null; status: string; default_revenue_share_pct: number; review_notes: string | null; created_at: string; profile: { email: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return (
    <>
      <PageHeader title="Instructors" description="Approve applicants, set default revenue share and review their courses." />
      {rows.length ? <div className="space-y-4">{rows.map((i) => {
        const earned = (earnings ?? []).filter((e) => e.instructor_id === i.id).reduce((s, e) => s + e.amount_paise, 0);
        const mine = (courses ?? []).filter((c) => c.instructor_id === i.id);
        return (
          <Card key={i.id} className="p-5">
            <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{i.display_name}</p><Badge tone={i.status === "approved" ? "success" : i.status === "pending" ? "warning" : "danger"}>{titleCase(i.status)}</Badge></div>
                <p className="text-sm text-ink-muted">{i.headline} · {i.profile?.email} · applied {formatDate(i.created_at)}</p>
                {i.bio ? <p className="mt-2 line-clamp-3 text-sm text-ink-soft">{i.bio}</p> : null}
                <p className="mt-2 text-[13px] text-ink-muted">Expertise: {i.expertise.join(", ") || "—"} {i.linkedin_url ? <>· <a href={i.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">LinkedIn</a></> : null} {i.website ? <>· <a href={i.website} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">Website</a></> : null}</p>
                <p className="mt-2 text-[13px]">Courses: {mine.length ? mine.map((c) => `${c.title} (${titleCase(c.status)})`).join(", ") : "none"} · Earnings: <strong>{formatINR(earned)}</strong></p>
              </div>
              <ActionForm action={adminReviewInstructorAction} className="space-y-2" compact>
                <input type="hidden" name="id" value={i.id} /><input type="hidden" name="user_id" value={i.user_id} />
                <div className="grid grid-cols-2 gap-2">
                  <Select name="status" defaultValue={i.status}><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></Select>
                  <label className="relative"><span className="sr-only">Default share %</span><Input name="default_revenue_share_pct" type="number" min={0} max={100} step="0.5" defaultValue={Number(i.default_revenue_share_pct)} /><span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">%</span></label>
                </div>
                <Input name="review_notes" placeholder="Notes to the applicant (optional)" defaultValue={i.review_notes ?? ""} />
                <SubmitButton size="sm">Save decision</SubmitButton>
              </ActionForm>
            </div>
          </Card>
        );
      })}</div> : <EmptyState title="No instructor applications yet" />}
    </>
  );
}
