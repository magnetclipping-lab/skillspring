import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Table } from "@/components/ui/primitives";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Audit log" };

export default async function AuditPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("id, action, entity_type, entity_id, metadata, created_at, actor:profiles(full_name, email)").order("created_at", { ascending: false }).limit(300);
  type Row = { id: string; action: string; entity_type: string; entity_id: string | null; metadata: Record<string, unknown>; created_at: string; actor: { full_name: string; email: string } | null };
  return (
    <>
      <PageHeader title="Audit log" description="Important administrative, payment and certificate events (latest 300)." />
      <Table>
        <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
        <tbody>{((data ?? []) as unknown as Row[]).map((a) => (
          <tr key={a.id}><td className="whitespace-nowrap">{formatDate(a.created_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td><td>{a.actor?.email ?? "system"}</td><td className="font-mono text-[12.5px]">{a.action}</td><td className="text-[12.5px]">{a.entity_type} <span className="font-mono text-ink-muted">{a.entity_id?.slice(0, 8)}</span></td><td className="max-w-md truncate font-mono text-[11.5px] text-ink-muted">{JSON.stringify(a.metadata)}</td></tr>
        ))}</tbody>
      </Table>
    </>
  );
}
