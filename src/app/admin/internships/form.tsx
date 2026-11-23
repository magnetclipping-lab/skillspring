import { adminSaveInternshipAction } from "@/lib/actions/admin";
import { ActionForm } from "@/components/ui/action-form";
import { SubmitButton } from "@/components/ui/form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import type { Internship } from "@/lib/types";

export function InternshipForm({ internship, employers }: { internship?: Internship; employers: { id: string; name: string; status: string }[] }) {
  const i = internship;
  return (
    <ActionForm action={adminSaveInternshipAction} className="space-y-4">
      {i ? <input type="hidden" name="id" value={i.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" name="title" required><Input id="title" name="title" defaultValue={i?.title} /></Field>
        <Field label="Slug" name="slug" required><Input id="slug" name="slug" defaultValue={i?.slug} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" name="kind" help="Employer = real vacancy from a verified employer"><Select id="kind" name="kind" defaultValue={i?.kind ?? "simulation"}><option value="employer">Employer internship</option><option value="simulation">Educational simulation</option><option value="project">Project-based experience</option></Select></Field>
        <Field label="Employer" name="employer_id" help="Required for employer internships"><Select id="employer_id" name="employer_id" defaultValue={i?.employer_id ?? ""}><option value="">— Proofwork —</option>{employers.map((e) => <option key={e.id} value={e.id} disabled={e.status !== "verified"}>{e.name}{e.status !== "verified" ? ` (${e.status})` : ""}</option>)}</Select></Field>
        <Field label="Status" name="status"><Select id="status" name="status" defaultValue={i?.status ?? "draft"}><option value="draft">Draft</option><option value="open">Open</option><option value="closed">Closed</option><option value="archived">Archived</option></Select></Field>
      </div>
      <Field label="Description" name="description" required><Textarea id="description" name="description" rows={5} defaultValue={i?.description} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Responsibilities" name="responsibilities" help="One per line"><Textarea id="responsibilities" name="responsibilities" rows={4} defaultValue={i?.responsibilities.join("\n")} /></Field>
        <div className="space-y-4">
          <Field label="Skills required" name="skills" help="Comma-separated"><Input id="skills" name="skills" defaultValue={i?.skills.join(", ")} /></Field>
          <Field label="Eligibility" name="eligibility"><Input id="eligibility" name="eligibility" defaultValue={i?.eligibility ?? ""} /></Field>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Location" name="location"><Input id="location" name="location" defaultValue={i?.location ?? ""} /></Field>
        <Field label="Work mode" name="work_mode"><Select id="work_mode" name="work_mode" defaultValue={i?.work_mode ?? "remote"}><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option></Select></Field>
        <Field label="Duration (weeks)" name="duration_weeks"><Input id="duration_weeks" name="duration_weeks" type="number" min={1} defaultValue={i?.duration_weeks ?? ""} /></Field>
        <Field label="Positions" name="positions"><Input id="positions" name="positions" type="number" min={1} defaultValue={i?.positions ?? ""} /></Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Deadline" name="deadline"><Input id="deadline" name="deadline" type="date" defaultValue={i?.deadline ?? ""} /></Field>
        <Field label="Stipend min (₹/month)" name="stipend_min_inr"><Input id="stipend_min_inr" name="stipend_min_inr" type="number" min={0} defaultValue={i?.stipend_min_inr ?? ""} /></Field>
        <Field label="Stipend max (₹/month)" name="stipend_max_inr"><Input id="stipend_max_inr" name="stipend_max_inr" type="number" min={0} defaultValue={i?.stipend_max_inr ?? ""} /></Field>
        <Field label="Stipend notes" name="stipend_notes"><Input id="stipend_notes" name="stipend_notes" defaultValue={i?.stipend_notes ?? ""} /></Field>
      </div>
      <div className="flex flex-wrap gap-6"><Checkbox name="is_paid" defaultChecked={i?.is_paid} label="Paid" /><Checkbox name="is_demo" defaultChecked={i?.is_demo} label="Demo listing" /></div>
      <SubmitButton>{i ? "Save internship" : "Create internship"}</SubmitButton>
    </ActionForm>
  );
}
