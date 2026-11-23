import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, PageHeader, Table } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { statusTone } from "@/components/editor/course-editor";
import { cn, formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "Courses" };
const filters = ["all", "pending_review", "draft", "changes_requested", "approved", "published", "archived"];

export default async function AdminCourses({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status = "all" } = await searchParams;
  const supabase = await createClient();
  let q = supabase.from("courses").select("id, title, slug, status, rights_status, is_demo, price_paise, updated_at, instructor:instructor_profiles(display_name)").order("updated_at", { ascending: false });
  if (status !== "all" && filters.includes(status)) q = q.eq("status", status);
  const { data } = await q;
  type Row = { id: string; title: string; status: string; rights_status: string; is_demo: boolean; price_paise: number; updated_at: string; instructor: { display_name: string } | null };
  return (
    <>
      <PageHeader title="Courses" actions={<ButtonLink href="/admin/courses/new"><Plus className="size-4" />New course</ButtonLink>} />
      <div className="mb-4 flex flex-wrap gap-2">{filters.map((f) => <Link key={f} href={`/admin/courses?status=${f}`} className={cn("rounded-full px-3 py-1.5 text-[13px] font-medium ring-1 ring-inset", status === f ? "bg-brand-600 text-white ring-brand-600" : "bg-surface text-ink-soft ring-line")}>{titleCase(f)}</Link>)}</div>
      <Table>
        <thead><tr><th>Course</th><th>Instructor</th><th>Status</th><th>Rights</th><th>Price</th><th>Updated</th></tr></thead>
        <tbody>{((data ?? []) as unknown as Row[]).map((c) => (
          <tr key={c.id}><td><Link href={`/admin/courses/${c.id}`} className="font-medium hover:text-white">{c.title}</Link>{c.is_demo ? <Badge tone="warning" className="ml-2">Demo</Badge> : null}</td><td>{c.instructor?.display_name ?? "—"}</td><td><Badge tone={statusTone[c.status]}>{titleCase(c.status)}</Badge></td><td>{titleCase(c.rights_status)}</td><td>{formatINR(c.price_paise)}</td><td>{formatDate(c.updated_at)}</td></tr>
        ))}</tbody>
      </Table>
    </>
  );
}
