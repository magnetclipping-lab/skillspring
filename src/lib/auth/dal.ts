import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile, InstructorProfile } from "@/lib/types";

export type SessionUser = {
  id: string;
  email: string;
  profile: Profile;
  roles: AppRole[];
  instructor: InstructorProfile | null;
};

/**
 * Data Access Layer: the one place that resolves "who is the caller".
 * Roles are read from the database (user_roles), never from client input
 * or user-editable JWT metadata.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Always render at request time where the session is involved (never prerender private pages).
  await connection();
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const [{ data: profile }, { data: roles }, { data: instructor }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", data.user.id).single(),
    supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    supabase.from("instructor_profiles").select("*").eq("user_id", data.user.id).maybeSingle(),
  ]);
  if (!profile) return null;

  return {
    id: data.user.id,
    email: data.user.email ?? profile.email ?? "",
    profile: profile as Profile,
    roles: ((roles ?? []) as { role: AppRole }[]).map((r) => r.role),
    instructor: (instructor as InstructorProfile | null) ?? null,
  };
});

export async function requireUser(next = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.profile.is_suspended) redirect("/account-suspended");
  return user;
}

export async function requireAdmin(next = "/admin"): Promise<SessionUser> {
  const user = await requireUser(next);
  if (!user.roles.includes("admin")) redirect("/forbidden");
  return user;
}

/** Approved instructors only. Pending applicants are sent to their application status. */
export async function requireInstructor(next = "/instructor"): Promise<SessionUser & { instructor: InstructorProfile }> {
  const user = await requireUser(next);
  if (!user.instructor) redirect("/become-instructor");
  if (user.instructor.status !== "approved") redirect("/dashboard/instructor-application");
  return user as SessionUser & { instructor: InstructorProfile };
}

export function hasRole(user: SessionUser | null, role: AppRole) {
  return Boolean(user?.roles.includes(role));
}
