"use server";
import { redirect } from "next/navigation";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { forgotSchema, formDataToObject, loginSchema, registerSchema, resetSchema } from "@/lib/validation";
import { safeRedirectPath } from "@/lib/utils";
import { sendTemplateEmail } from "@/lib/email/send";
import type { ActionState } from "@/components/ui/form";

const notConfigured: ActionState = { ok: false, message: "Sign-in is unavailable: Supabase is not configured for this environment." };

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return notConfigured;
  const parsed = registerSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  if (!(await rateLimit("register")).ok) return { ok: false, message: "Too many sign-up attempts. Please try again later." };

  const supabase = await createClient();
  const next = safeRedirectPath(String(fd.get("next") ?? ""), "/dashboard");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    // Don't reveal whether an account exists.
    if (/already registered|exists/i.test(error.message)) return { ok: true, message: "Check your inbox to verify your email and finish signing up." };
    return { ok: false, message: error.message };
  }
  await sendTemplateEmail({ to: parsed.data.email, template: "welcome", data: { name: parsed.data.fullName, url: `${publicEnv.siteUrl}/courses` }, dedupeKey: `welcome:${data.user?.id}` });
  if (data.session) redirect(next); // email confirmation disabled in this project
  return { ok: true, message: "Almost there! We've sent a verification link to your email. Click it to activate your account." };
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return notConfigured;
  const parsed = loginSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const [ipLimit, accountLimit] = await Promise.all([rateLimit("login"), rateLimit("login", `acct:${parsed.data.email}`)]);
  if (!ipLimit.ok || !accountLimit.ok) return { ok: false, message: "Too many sign-in attempts. Please wait a few minutes and try again." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/confirm/i.test(error.message)) return { ok: false, message: "Please verify your email address first. Check your inbox for the link." };
    return { ok: false, message: "Incorrect email or password." };
  }
  redirect(safeRedirectPath(String(fd.get("next") ?? ""), "/dashboard"));
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return notConfigured;
  const parsed = forgotSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  if (!(await rateLimit("passwordReset")).ok) return { ok: false, message: "Too many requests. Please try again later." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/reset-password` });
  return { ok: true, message: "If an account exists for that email, a password reset link is on its way." };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!isSupabaseConfigured()) return notConfigured;
  const parsed = resetSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return { ok: false, errors: parsed.error.flatten().fieldErrors };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, message: "Your reset link has expired. Please request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false, message: error.message };
  redirect("/dashboard?password=updated");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
