import Link from "next/link";
import { Search } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, Input, PageHeader, Table } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Students" };

export default async function AdminStudents({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const { q = "", page = "1" } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, full_name, email, college, created_at, is_suspended, user_roles(role)", { count: "exact" }).order("created_at", { ascending: false }).range((p - 1) * 50, p * 50 - 1);
  const term = q.replace(/[%_,()]/g, "").trim().slice(0, 80);
  if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,college.ilike.%${term}%`);
  const { data, count } = await query;
  type Row = { id: string; full_name: string; email: string | null; college: string | null; created_at: string; is_suspended: boolean; user_roles: { role: string }[] };
  return (
    <>
      <PageHeader title="Students & users" description={`${count ?? 0} accounts`} />
      <form className="mb-4 flex max-w-lg gap-2" role="search"><label className="relative flex-1"><span className="sr-only">Search</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" /><Input name="q" defaultValue={q} placeholder="Name, email or college" className="pl-9" /></label><Button type="submit">Search</Button></form>
      <Table>
        <thead><tr><th>Name</th><th>Email</th><th>College</th><th>Roles</th><th>Joined</th></tr></thead>
        <tbody>{((data ?? []) as unknown as Row[]).map((u) => (
          <tr key={u.id}><td><Link href={`/admin/students/${u.id}`} className="font-medium hover:text-white">{u.full_name || "—"}</Link>{u.is_suspended ? <Badge tone="danger" className="ml-2">Suspended</Badge> : null}</td><td>{u.email}</td><td>{u.college ?? "—"}</td><td className="space-x-1">{u.user_roles.map((r) => <Badge key={r.role} tone={r.role === "admin" ? "danger" : r.role === "instructor" ? "violet" : "neutral"}>{r.role}</Badge>)}</td><td>{formatDate(u.created_at)}</td></tr>
        ))}</tbody>
      </Table>
      <div className="mt-4 flex gap-3 text-sm">{p > 1 ? <Link href={`/admin/students?q=${encodeURIComponent(q)}&page=${p - 1}`} className="font-semibold text-brand-300">← Previous</Link> : null}{(count ?? 0) > p * 50 ? <Link href={`/admin/students?q=${encodeURIComponent(q)}&page=${p + 1}`} className="font-semibold text-brand-300">Next →</Link> : null}</div>
    </>
  );
}
