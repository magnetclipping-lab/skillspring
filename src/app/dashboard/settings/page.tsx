import Link from "next/link";
import { requireUser } from "@/lib/auth/dal";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Account settings" };

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");
  return (
    <>
      <PageHeader title="Account settings" description="Your name appears on certificates exactly as entered here." />
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card><CardHeader title="Profile" /><div className="p-5"><ProfileForm profile={user.profile} /></div></Card>
        <div className="space-y-6">
          <Card className="p-5">
            <p className="font-semibold">Sign-in</p>
            <p className="mt-1 text-sm text-ink-muted">{user.email}</p>
            <Link href="/forgot-password" className="mt-3 inline-block text-sm font-semibold text-brand-300 hover:underline">Change password</Link>
          </Card>
          <Card className="p-5">
            <p className="font-semibold">Teach on Proofwork</p>
            <p className="mt-1 text-sm text-ink-muted">{user.instructor ? `Instructor application: ${user.instructor.status}` : "Share your expertise with students."}</p>
            <Link href={user.instructor ? "/dashboard/instructor-application" : "/become-instructor"} className="mt-3 inline-block text-sm font-semibold text-brand-300 hover:underline">{user.instructor ? "View application" : "Apply to teach"}</Link>
          </Card>
          <Card className="p-5">
            <p className="font-semibold">Your data</p>
            <p className="mt-1 text-sm text-ink-muted">To request a copy or deletion of your data, contact us via the <Link href="/contact" className="font-medium text-brand-300 hover:underline">contact page</Link>. See our <Link href="/privacy" className="font-medium text-brand-300 hover:underline">Privacy Policy</Link>.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
