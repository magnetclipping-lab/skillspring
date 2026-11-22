"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getSessionUser, requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { ambassadorReviewSchema, ambassadorSchema, formDataToObject } from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/components/ui/form";

const SUCCESS = "Application received. We review applications every week and will contact you by email or phone if you're shortlisted.";

/** Public, free application. Validated + rate limited here; inserted with the service role (no public insert policy). */
export async function applyAmbassadorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = ambassadorSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  if (parsed.data.website) return { ok: true, message: SUCCESS }; // honeypot hit
  if (!hasAdminClient()) return { ok: false, message: "Applications aren't open yet. Please email us instead." };
  if (!(await rateLimit("ambassador")).ok) return { ok: false, message: "Too many attempts. Please try again in an hour." };
  const user = await getSessionUser();
  const { website: _w, consent: _c, ...row } = parsed.data;
  void _w;
  void _c;
  const { error } = await createAdminClient().from("ambassador_applications").insert({ ...row, user_id: user?.id ?? null });
  if (error) {
    if (error.code === "23505") return { ok: false, errors: { email: ["You've already applied with this email. We'll be in touch."] } };
    console.error("[ambassador] insert failed", error.code, error.message);
    return { ok: false, message: "Could not submit your application. Please try again." };
  }
  return { ok: true, message: SUCCESS };
}

function referralCode(name: string) {
  const base = name.replace(/[^a-z]/gi, "").slice(0, 5).toUpperCase() || "SS";
  return `${base}${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function adminReviewAmbassadorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = ambassadorReviewSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, message: "Invalid update." };
  const supabase = await createClient();
  const { data: current } = await supabase.from("ambassador_applications").select("full_name, referral_code").eq("id", parsed.data.id).maybeSingle();
  if (!current) return { ok: false, message: "Application not found." };
  const update: Record<string, unknown> = {
    status: parsed.data.status,
    admin_notes: parsed.data.admin_notes,
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
  };
  if (parsed.data.status === "active" && !current.referral_code) update.referral_code = referralCode(current.full_name);
  const { error } = await supabase.from("ambassador_applications").update(update).eq("id", parsed.data.id);
  if (error) return { ok: false, message: "Could not save. Please try again." };
  await audit(admin.id, "ambassador.reviewed", "ambassador_application", parsed.data.id, { status: parsed.data.status });
  revalidatePath("/admin/ambassadors");
  return { ok: true, message: "Saved." };
}
