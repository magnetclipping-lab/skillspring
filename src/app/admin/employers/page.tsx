import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { adminAddEmployerMemberAction, adminSaveEmployerAction, adminSetEmployerStatusAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Alert, Badge, Card, CardHeader, Field, Input, PageHeader, Textarea } from "@/components/ui/primitives";
import { titleCase } from "@/lib/utils";

export const metadata = { title: "Employers" };

export default async function AdminEmployers() {
  await requireAdmin();
  const supabase = await createClient();
  const [{ data: employers }, { data: members }] = await Promise.all([
    supabase.from("employers").select("*").order("created_at", { ascending: false }),
    supabase.from("employer_members").select("employer_id, user:profiles(full_name, email)"),
  ]);
  type M = { employer_id: string; user: { full_name: string; email: string } | null };
  return (
    <>
      <PageHeader title="Employers" description="Only verified employers can have employer internships. Verify each organisation (e.g. official email domain, company registration) before approving." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-4">
          {(employers ?? []).length ? (employers ?? []).map((e) => (
            <Card key={e.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-semibold">{e.name} <Badge tone={e.status === "verified" ? "success" : e.status === "pending" ? "warning" : "danger"}>{titleCase(e.status)}</Badge></p><p className="text-sm text-ink-muted">{[e.industry, e.location, e.website].filter(Boolean).join(" · ")}</p></div>
                <div className="flex gap-2">{["verified", "rejected", "suspended"].filter((s) => s !== e.status).map((s) => <form key={s} action={adminSetEmployerStatusAction}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value={s} /><SubmitButton size="sm" variant={s === "verified" ? "primary" : "secondary"}>{s === "verified" ? "Verify" : titleCase(s)}</SubmitButton></form>)}</div>
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-[13px] font-semibold">Employer accounts</p>
                <ul className="mt-1 text-[13px] text-ink-soft">{((members ?? []) as unknown as M[]).filter((m) => m.employer_id === e.id).map((m, i) => <li key={i}>{m.user?.full_name} · {m.user?.email}</li>)}</ul>
                <ActionForm action={adminAddEmployerMemberAction} className="mt-2 flex gap-2" compact><input type="hidden" name="employer_id" value={e.id} /><Input name="email" type="email" placeholder="User email to link" required /><SubmitButton size="md" variant="secondary">Add</SubmitButton></ActionForm>
              </div>
            </Card>
          )) : <Alert tone="info">No employers yet. Add one when an organisation partners with you.</Alert>}
        </div>
        <Card><CardHeader title="Add employer" />
          <ActionForm action={adminSaveEmployerAction} className="space-y-3 p-5">
            <Field label="Organisation name" name="name" required><Input id="name" name="name" /></Field>
            <Field label="Slug" name="slug" required><Input id="slug" name="slug" placeholder="acme-pvt-ltd" /></Field>
            <Field label="Website" name="website"><Input id="website" name="website" type="url" /></Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Industry" name="industry"><Input id="industry" name="industry" /></Field><Field label="Location" name="location"><Input id="location" name="location" /></Field></div>
            <Field label="Description" name="description"><Textarea id="description" name="description" rows={3} /></Field>
            <SubmitButton>Add employer</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
