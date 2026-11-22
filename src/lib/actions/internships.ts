"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { applicationSchema, formDataToObject } from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { sendTemplateEmail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import type { ActionState } from "@/components/ui/form";

export async function applyToInternshipAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = applicationSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  if (!(await rateLimit("apply", user.id)).ok) return { ok: false, message: "Too many applications in a short time. Please try again later." };
  if (parsed.data.resume_path && !parsed.data.resume_path.startsWith(`${user.id}/`)) return { ok: false, message: "Invalid resume file." };

  const supabase = await createClient();
  const { data: internship } = await supabase.from("internships").select("id, title, slug").eq("id", parsed.data.internship_id).maybeSingle();
  if (!internship) return { ok: false, message: "This opportunity is no longer available." };

  const { error } = await supabase.from("internship_applications").insert({
    internship_id: internship.id,
    user_id: user.id,
    cover_letter: parsed.data.cover_letter,
    phone: parsed.data.phone,
    portfolio_url: parsed.data.portfolio_url,
    resume_path: parsed.data.resume_path,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You have already applied to this opportunity." };
    return { ok: false, message: "Applications are closed for this opportunity." };
  }
  await sendTemplateEmail({ to: user.email, template: "application_received", dedupeKey: `application:${internship.id}:${user.id}`, data: { name: user.profile.full_name, title: internship.title, url: `${publicEnv.siteUrl}/dashboard/applications` } });
  revalidatePath(`/internships/${internship.slug}`);
  revalidatePath("/dashboard/applications");
  return { ok: true, message: "Application submitted! Track its status from your dashboard." };
}

export async function toggleSaveInternshipAction(internshipId: string, slug: string) {
  const user = await requireUser(`/internships/${slug}`);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("saved_internships").select("id").eq("internship_id", internshipId).eq("user_id", user.id).maybeSingle();
  if (existing) await supabase.from("saved_internships").delete().eq("id", existing.id);
  else await supabase.from("saved_internships").insert({ internship_id: internshipId, user_id: user.id });
  revalidatePath(`/internships/${slug}`);
  revalidatePath("/dashboard/saved");
  return { saved: !existing };
}

export async function withdrawApplicationAction(applicationId: string) {
  await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_application", { p_application_id: applicationId });
  revalidatePath("/dashboard/applications");
  return error ? { ok: false, message: error.message } : { ok: true };
}
