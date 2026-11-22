import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { adminMarkMessageHandledAction } from "@/lib/actions/admin";
import { SubmitButton } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDate, titleCase } from "@/lib/utils";

export const metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("contact_messages").select("*").order("handled").order("created_at", { ascending: false }).limit(200);
  return (
    <>
      <PageHeader title="Messages" description="Contact, partnership, employer and refund enquiries." />
      {data?.length ? <div className="space-y-3">{data.map((m) => (
        <Card key={m.id} className={`p-5 ${m.handled ? "opacity-60" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="font-semibold">{m.name} <span className="font-normal text-ink-muted">· {m.email}{m.organisation ? ` · ${m.organisation}` : ""}</span></p><p className="text-[12px] text-ink-muted">{formatDate(m.created_at)} <Badge tone={m.topic === "refund" ? "warning" : "brand"} className="ml-1">{titleCase(m.topic)}</Badge></p></div>
            <form action={adminMarkMessageHandledAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="handled" value={m.handled ? "false" : "true"} /><SubmitButton size="sm" variant="secondary">{m.handled ? "Reopen" : "Mark handled"}</SubmitButton></form>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{m.message}</p>
        </Card>
      ))}</div> : <EmptyState title="No messages" />}
    </>
  );
}
