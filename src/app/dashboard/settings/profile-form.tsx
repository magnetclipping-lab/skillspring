"use client";
import Image from "next/image";
import { useActionState, useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { FileUpload } from "@/components/ui/file-upload";
import { updateProfileAction } from "@/lib/actions/account";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState<ActionState, FormData>(updateProfileAction, null);
  const [avatar, setAvatar] = useState(profile.avatar_url ?? "");
  const e = state?.errors ?? {};
  return (
    <form action={action} className="space-y-4">
      <FormMessage state={state} />
      <div className="flex items-center gap-4">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl bg-brand-100">{avatar ? <Image src={avatar} alt="Profile photo" fill className="object-cover" sizes="64px" /> : null}</div>
        <div className="flex-1"><FileUpload kind="avatar" name="avatar_path" accept="image/png,image/jpeg,image/webp" label="Profile photo (max 2 MB)" onUploaded={(r) => r.url && setAvatar(r.url)} /></div>
        <input type="hidden" name="avatar_url" value={avatar} />
      </div>
      <Field label="Full name" name="full_name" error={e.full_name} required><Input id="full_name" name="full_name" defaultValue={profile.full_name} autoComplete="name" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" name="phone" error={e.phone}><Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} autoComplete="tel" /></Field>
        <Field label="Graduation year" name="graduation_year" error={e.graduation_year}><Input id="graduation_year" name="graduation_year" type="number" min={1980} max={2100} defaultValue={profile.graduation_year ?? ""} /></Field>
        <Field label="College / University" name="college" error={e.college}><Input id="college" name="college" defaultValue={profile.college ?? ""} /></Field>
        <Field label="Degree" name="degree" error={e.degree}><Input id="degree" name="degree" defaultValue={profile.degree ?? ""} placeholder="e.g. B.Com, BBA, B.Tech" /></Field>
      </div>
      <Field label="Skills" name="skills" error={e.skills} help="Comma-separated, e.g. Excel, SQL, Public speaking"><Input id="skills" name="skills" defaultValue={profile.skills.join(", ")} /></Field>
      <Field label="About you" name="bio" error={e.bio}><Textarea id="bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={2000} /></Field>
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}
