"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { contactSchema, formDataToObject, instructorApplicationSchema, profileSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/security/rate-limit";
import { sendTemplateEmail } from "@/lib/email/send";
import { getSessionUser } from "@/lib/auth/dal";
import type { ActionState } from "@/components/ui/form";

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser("/dashboard/settings");
  const parsed = profileSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const avatar = String(fd.get("avatar_url") ?? "");
  const supabase = await createClient();
  const update: Record<string, unknown> = { ...parsed.data };
  // Only accept avatar URLs that point at the caller's own folder in our public bucket.
  if (avatar && avatar.includes(`/storage/v1/object/public/avatars/${user.id}/`)) update.avatar_url = avatar;
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { ok: false, message: "Could not save your profile." };
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function applyAsInstructorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser("/become-instructor");
  const parsed = instructorApplicationSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const { rights_confirmation: _rc, ...profile } = parsed.data;
  void _rc;
  const supabase = await createClient();
  const { error } = user.instructor
    ? await supabase.from("instructor_profiles").update(profile).eq("id", user.instructor.id)
    : await supabase.from("instructor_profiles").insert({ ...profile, user_id: user.id });
  if (error) return { ok: false, message: "Could not submit your application." };
  if (!user.instructor) await sendTemplateEmail({ to: user.email, template: "instructor_application", data: { name: user.profile.full_name }, dedupeKey: `instructor-app:${user.id}` });
  revalidatePath("/dashboard/instructor-application");
  return { ok: true, message: user.instructor ? "Profile updated." : "Application received! We'll review it and email you." };
}

export async function contactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = contactSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  if (parsed.data.website) return { ok: true, message: "Thanks! We'll get back to you soon." }; // honeypot hit
  if (!hasAdminClient()) return { ok: false, message: "The contact form isn't configured yet. Please email us instead." };
  if (!(await rateLimit("contact")).ok) return { ok: false, message: "Too many messages. Please try again later." };
  const user = await getSessionUser();
  const { website: _w, ...row } = parsed.data;
  void _w;
  const { error } = await createAdminClient().from("contact_messages").insert({ ...row, user_id: user?.id ?? null });
  if (error) {
    console.error("[contact] insert failed", error.code, error.message);
    return { ok: false, message: "Could not send your message. Please try again." };
  }
  return { ok: true, message: "Thanks! Your message has been sent. We usually reply within two working days." };
}
