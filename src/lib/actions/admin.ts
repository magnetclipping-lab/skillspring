"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { employerSchema, formDataToObject, internshipSchema, payoutSchema, refundSchema, applicationStatusSchema } from "@/lib/validation";
import { initiateRefund, PaymentError } from "@/lib/payments/service";
import { RazorpayError } from "@/lib/payments/razorpay";
import { sendTemplateEmail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import { titleCase } from "@/lib/utils";
import type { ActionState } from "@/components/ui/form";

/**
 * Administrator actions. Each one re-checks the admin role server-side and runs
 * with the admin's own session, so RLS admin policies apply; every change is audit-logged.
 */

const uuid = z.string().uuid();
const msg = (e: { message?: string } | null, fallback: string): ActionState => ({ ok: false, message: e?.message ?? fallback });

// ---------------- Courses ----------------
export async function adminReviewCourseAction(fd: FormData) {
  await requireAdmin();
  const id = uuid.parse(fd.get("course_id"));
  const decision = z.enum(["approve", "request_changes", "archive"]).parse(fd.get("decision"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_review_course", { p_course_id: id, p_decision: decision, p_notes: String(fd.get("notes") ?? "").slice(0, 2000) || null });
  revalidatePath(`/admin/courses/${id}`);
  redirect(`/admin/courses/${id}?${error ? `error=${encodeURIComponent(error.message)}` : `done=${decision}`}`);
}

export async function adminPublishCourseAction(fd: FormData) {
  await requireAdmin();
  const id = uuid.parse(fd.get("course_id"));
  const publish = fd.get("publish") === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_publish_course", { p_course_id: id, p_publish: publish });
  revalidatePath(`/admin/courses/${id}`);
  revalidatePath("/programs");
  revalidatePath("/");
  redirect(`/admin/courses/${id}?${error ? `error=${encodeURIComponent(error.message)}` : `done=${publish ? "published" : "unpublished"}`}`);
}

export async function adminCourseSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({
    course_id: uuid,
    rights_status: z.enum(["pending", "owned", "licensed", "instructor_owned", "rejected"]),
    rights_notes: z.string().max(2000).optional(),
    is_demo: z.string().optional(),
    instructor_id: z.union([uuid, z.literal("")]),
  }).safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, message: "Invalid input." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("courses").update({
    rights_status: d.rights_status, rights_notes: d.rights_notes || null, is_demo: d.is_demo === "on", instructor_id: d.instructor_id || null,
  }).eq("id", d.course_id);
  if (error) return msg(error, "Could not save.");
  await audit(admin.id, "course.settings", "course", d.course_id, { rights_status: d.rights_status, is_demo: d.is_demo === "on", instructor_id: d.instructor_id || null });
  revalidatePath(`/admin/courses/${d.course_id}`);
  return { ok: true, message: "Settings saved." };
}

export async function adminSetCourseShareAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ course_id: uuid, instructor_id: uuid, share_pct: z.coerce.number().min(0).max(100) }).safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, message: "Enter a share between 0 and 100." };
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase.from("instructor_revenue_shares").update({ effective_to: now }).eq("course_id", parsed.data.course_id).is("effective_to", null);
  const { error } = await supabase.from("instructor_revenue_shares").insert({ ...parsed.data, created_by: admin.id, effective_from: now });
  if (error) return msg(error, "Could not save share.");
  await audit(admin.id, "revenue_share.set", "course", parsed.data.course_id, parsed.data);
  revalidatePath(`/admin/courses/${parsed.data.course_id}`);
  return { ok: true, message: "Revenue share updated for future sales." };
}

export async function adminDeleteCourseAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid.parse(fd.get("course_id"));
  const supabase = await createClient();
  // Courses with sales can't be deleted (FK restrict) — archive instead.
  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) {
    await supabase.rpc("admin_review_course", { p_course_id: id, p_decision: "archive", p_notes: "Archived instead of deleted (has related records)" });
    redirect(`/admin/courses/${id}?done=archived`);
  }
  await audit(admin.id, "course.deleted", "course", id);
  redirect("/admin/courses");
}

// ---------------- Users ----------------
export async function adminSuspendUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.parse(fd.get("user_id"));
  const suspend = fd.get("suspend") === "true";
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 500);
  if (id === admin.id) return { ok: false, message: "You can't suspend your own account." };
  if (suspend && !reason) return { ok: false, message: "A reason is required to suspend an account." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_suspended: suspend, suspended_reason: suspend ? reason : null }).eq("id", id);
  if (error) return msg(error, "Could not update account.");
  await audit(admin.id, suspend ? "user.suspended" : "user.unsuspended", "profile", id, { reason });
  revalidatePath(`/admin/students/${id}`);
  return { ok: true, message: suspend ? "Account suspended." : "Account reinstated." };
}

export async function adminSetRoleAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid.parse(fd.get("user_id"));
  const role = z.enum(["admin", "instructor", "student"]).parse(fd.get("role"));
  const grant = fd.get("grant") === "true";
  if (id === admin.id && role === "admin" && !grant) redirect(`/admin/students/${id}?error=${encodeURIComponent("You can't remove your own admin role.")}`);
  const supabase = await createClient();
  if (grant) await supabase.from("user_roles").upsert({ user_id: id, role, granted_by: admin.id }, { onConflict: "user_id,role" });
  else await supabase.from("user_roles").delete().eq("user_id", id).eq("role", role);
  await audit(admin.id, grant ? "role.granted" : "role.revoked", "profile", id, { role });
  revalidatePath(`/admin/students/${id}`);
}

export async function adminGrantEnrolmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({ user_id: uuid, course_id: uuid }).safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, message: "Choose a course." };
  const supabase = await createClient();
  const { data: existing } = await supabase.from("enrolments").select("id, status").eq("user_id", parsed.data.user_id).eq("course_id", parsed.data.course_id).maybeSingle();
  if (existing?.status === "active") return { ok: false, message: "Already enrolled." };
  // Admin enrolment writes are done with the service role (no client insert policy exists for enrolments).
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { error } = existing
    ? await createAdminClient().from("enrolments").update({ status: "active", source: "admin_grant" }).eq("id", existing.id)
    : await createAdminClient().from("enrolments").insert({ ...parsed.data, source: "admin_grant", status: "active" });
  if (error) return msg(error, "Could not grant access.");
  await audit(admin.id, "enrolment.granted", "profile", parsed.data.user_id, { course_id: parsed.data.course_id });
  revalidatePath(`/admin/students/${parsed.data.user_id}`);
  return { ok: true, message: "Access granted (not a sale — no revenue recorded)." };
}

export async function adminRevokeEnrolmentAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid.parse(fd.get("enrolment_id"));
  const userId = uuid.parse(fd.get("user_id"));
  const supabase = await createClient();
  await supabase.from("enrolments").update({ status: "revoked" }).eq("id", id);
  await audit(admin.id, "enrolment.revoked", "enrolment", id);
  revalidatePath(`/admin/students/${userId}`);
}

// ---------------- Instructors ----------------
export async function adminReviewInstructorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = z.object({
    id: uuid, user_id: uuid, status: z.enum(["pending", "approved", "rejected", "suspended"]),
    default_revenue_share_pct: z.coerce.number().min(0).max(100), review_notes: z.string().max(2000).optional(),
  }).safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, message: "Invalid input." };
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("instructor_profiles").update({
    status: d.status, default_revenue_share_pct: d.default_revenue_share_pct, review_notes: d.review_notes || null,
    reviewed_by: admin.id, reviewed_at: new Date().toISOString(),
  }).eq("id", d.id);
  if (error) return msg(error, "Could not update instructor.");
  if (d.status === "approved") await supabase.from("user_roles").upsert({ user_id: d.user_id, role: "instructor", granted_by: admin.id }, { onConflict: "user_id,role" });
  else await supabase.from("user_roles").delete().eq("user_id", d.user_id).eq("role", "instructor");
  await audit(admin.id, `instructor.${d.status}`, "instructor_profile", d.id, { share: d.default_revenue_share_pct });
  revalidatePath("/admin/instructors");
  return { ok: true, message: "Instructor updated." };
}

// ---------------- Internships & employers ----------------
export async function adminSaveInternshipAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = internshipSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  if (parsed.data.kind === "employer") {
    const { data: emp } = await supabase.from("employers").select("status").eq("id", parsed.data.employer_id!).maybeSingle();
    if (emp?.status !== "verified") return { ok: false, message: "Employer internships require a verified employer." };
  }
  const id = String(fd.get("id") ?? "");
  const row = { ...parsed.data, employer_id: parsed.data.kind === "employer" ? parsed.data.employer_id : parsed.data.employer_id, is_demo: fd.get("is_demo") === "on" };
  const res = id
    ? await supabase.from("internships").update(row).eq("id", id).select("id").single()
    : await supabase.from("internships").insert({ ...row, created_by: admin.id }).select("id").single();
  if (res.error || !res.data) return { ok: false, message: res.error?.code === "23505" ? "That slug is already in use." : res.error?.message ?? "Could not save." };
  await audit(admin.id, id ? "internship.updated" : "internship.created", "internship", res.data.id, { kind: row.kind, status: row.status });
  revalidatePath("/internships");
  if (!id) redirect(`/admin/internships/${res.data.id}`);
  revalidatePath(`/admin/internships/${id}`);
  return { ok: true, message: "Internship saved." };
}

export async function adminUpdateApplicationAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = applicationStatusSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, message: "Invalid status." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_application_status", { p_application_id: parsed.data.application_id, p_status: parsed.data.status, p_note: parsed.data.note });
  if (error) return msg(error, "Could not update.");
  const { data: app } = await supabase.from("internship_applications").select("user:profiles(full_name, email), internship:internships(title)").eq("id", parsed.data.application_id).single();
  const a = app as unknown as { user: { full_name: string; email: string } | null; internship: { title: string } | null } | null;
  if (a?.user?.email) {
    await sendTemplateEmail({ to: a.user.email, template: "application_status", data: { name: a.user.full_name, title: a.internship?.title, status: titleCase(parsed.data.status), note: parsed.data.note ?? undefined, url: `${publicEnv.siteUrl}/dashboard/applications` } });
  }
  revalidatePath("/admin/applications");
  return { ok: true, message: "Status updated and applicant notified." };
}

export async function adminSaveEmployerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = employerSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase.from("employers").insert(parsed.data).select("id").single();
  if (error || !data) return { ok: false, message: error?.code === "23505" ? "That slug is already in use." : "Could not create employer." };
  await audit(admin.id, "employer.created", "employer", data.id, { name: parsed.data.name });
  revalidatePath("/admin/employers");
  return { ok: true, message: "Employer added (pending verification)." };
}

export async function adminSetEmployerStatusAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid.parse(fd.get("id"));
  const status = z.enum(["pending", "verified", "rejected", "suspended"]).parse(fd.get("status"));
  const supabase = await createClient();
  await supabase.from("employers").update({ status, verified_by: status === "verified" ? admin.id : null, verified_at: status === "verified" ? new Date().toISOString() : null }).eq("id", id);
  await audit(admin.id, `employer.${status}`, "employer", id);
  revalidatePath("/admin/employers");
}

export async function adminAddEmployerMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const employerId = uuid.parse(fd.get("employer_id"));
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (!profile) return { ok: false, message: "No SkillSpring account with that email. Ask them to register first." };
  const { error } = await supabase.from("employer_members").insert({ employer_id: employerId, user_id: profile.id });
  if (error) return { ok: false, message: error.code === "23505" ? "Already a member." : "Could not add member." };
  await audit(admin.id, "employer.member_added", "employer", employerId, { user_id: profile.id });
  revalidatePath("/admin/employers");
  return { ok: true, message: "Member added. They can now review applications for this employer." };
}

// ---------------- Finance ----------------
export async function adminRefundAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = refundSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  try {
    const r = await initiateRefund(admin.id, parsed.data.payment_id, parsed.data.amount, parsed.data.reason);
    revalidatePath("/admin/finance");
    return { ok: true, message: `Refund ${r.id} created with status “${r.status}”. Final status is confirmed by Razorpay webhook.` };
  } catch (e) {
    if (e instanceof PaymentError || e instanceof RazorpayError) return { ok: false, message: e.message };
    return { ok: false, message: "Refund failed." };
  }
}

export async function adminCreatePayoutAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = payoutSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data, error } = await supabase.from("instructor_payouts").insert({ ...parsed.data, created_by: admin.id, status: "pending" }).select("id").single();
  if (error || !data) return msg(error, "Could not record payout.");
  await audit(admin.id, "payout.created", "instructor_payout", data.id, { amount_paise: parsed.data.amount });
  revalidatePath("/admin/finance");
  return { ok: true, message: "Payout recorded as pending. Mark it paid after the bank transfer." };
}

export async function adminMarkPayoutPaidAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = uuid.parse(fd.get("id"));
  const reference = String(fd.get("reference") ?? "").trim().slice(0, 200);
  const supabase = await createClient();
  await supabase.from("instructor_payouts").update({ status: "paid", paid_at: new Date().toISOString(), ...(reference ? { reference } : {}) }).eq("id", id);
  await audit(admin.id, "payout.paid", "instructor_payout", id, { reference });
  revalidatePath("/admin/finance");
}

// ---------------- Certificates & messages ----------------
export async function adminRevokeCertificateAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_certificate", { p_certificate_id: uuid.parse(fd.get("id")), p_reason: String(fd.get("reason") ?? "") });
  if (error) return msg(error, "Could not revoke.");
  revalidatePath("/admin/certificates");
  return { ok: true, message: "Certificate revoked." };
}

export async function adminMarkMessageHandledAction(fd: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("contact_messages").update({ handled: fd.get("handled") === "true" }).eq("id", uuid.parse(fd.get("id")));
  revalidatePath("/admin/messages");
}
