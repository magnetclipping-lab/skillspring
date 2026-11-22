import Link from "next/link";
import { Download, Megaphone } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatDate, titleCase } from "@/lib/utils";
import { AmbassadorReviewForm } from "./review-form";

export const metadata = { title: "Campus ambassadors" };

type Row = {
  id: string; created_at: string; full_name: string; email: string; phone: string; college: string; city: string; course_and_year: string;
  social_url: string | null; motivation: string; status: string; referral_code: string | null; admin_notes: string | null;
};
const tone: Record<string, "brand" | "success" | "warning" | "neutral" | "danger"> = { applied: "brand", shortlisted: "warning", active: "success", rejected: "danger", inactive: "neutral" };
const FILTERS = ["all", "applied", "shortlisted", "active", "rejected", "inactive"] as const;

export default async function AmbassadorsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "all" } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("ambassador_applications").select("*").order("created_at", { ascending: false }).limit(300);
  if (status !== "all" && (FILTERS as readonly string[]).includes(status)) q = q.eq("status", status);
  const [{ data }, { count: total }, { count: active }, { count: pending }] = await Promise.all([
    q,
    supabase.from("ambassador_applications").select("id", { count: "exact", head: true }),
    supabase.from("ambassador_applications").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("ambassador_applications").select("id", { count: "exact", head: true }).eq("status", "applied"),
  ]);
  const rows = (data ?? []) as Row[];
  return (
    <>
      <PageHeader
        title="Campus ambassadors"
        description="Free applications from students. Setting someone to Active gives them a referral code."
        actions={<a href={"/api/admin/export/ambassadors"} className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-brand-50"><Download className="size-4" />Export CSV</a>}
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Applications" value={total ?? 0} />
        <StatCard label="Waiting for review" value={pending ?? 0} />
        <StatCard label="Active ambassadors" value={active ?? 0} />
      </div>
      <nav className="mb-5 flex flex-wrap gap-2" aria-label="Filter by status">
        {FILTERS.map((f) => (
          <Link key={f} href={f === "all" ? "/admin/ambassadors" : `/admin/ambassadors?status=${f}`} aria-current={status === f ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${status === f ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-line hover:bg-brand-50"}`}>{titleCase(f)}</Link>
        ))}
      </nav>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">{r.full_name}</p>
                  <p className="text-[13px] text-ink-muted">{r.college}, {r.city}. {r.course_and_year}</p>
                  <p className="mt-1 text-[13px] text-ink-muted"><a className="hover:underline" href={`mailto:${r.email}`}>{r.email}</a>, {r.phone}{r.social_url ? <>, <a href={r.social_url} target="_blank" rel="noopener noreferrer nofollow" className="text-brand-600 hover:underline">profile</a></> : null}</p>
                </div>
                <div className="text-right">
                  <Badge tone={tone[r.status] ?? "neutral"}>{titleCase(r.status)}</Badge>
                  <p className="mt-1 text-[12px] text-ink-muted">Applied {formatDate(r.created_at)}</p>
                  {r.referral_code ? <p className="mt-1 font-mono text-[12px] text-ink">Code {r.referral_code}</p> : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-ink-soft">{r.motivation}</p>
              <AmbassadorReviewForm id={r.id} status={r.status} notes={r.admin_notes} />
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Megaphone className="size-5" />} title="No applications yet" description="Share the Campus Ambassador page with student communities to get your first applicants." action={<Link href="/campus-ambassador" target="_blank" className="text-sm font-semibold text-brand-600 hover:underline">Open the public page</Link>} />
      )}
    </>
  );
}
