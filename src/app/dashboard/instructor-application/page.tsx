import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/dal";
import { Alert, Card, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { formatDate, titleCase } from "@/lib/utils";
import { InstructorApplicationForm } from "@/app/(site)/become-instructor/form";

export const metadata = { title: "Instructor application" };

export default async function InstructorApplicationPage() {
  const user = await requireUser("/dashboard/instructor-application");
  if (!user.instructor) redirect("/become-instructor");
  const ip = user.instructor;
  return (
    <>
      <PageHeader title="Instructor application" description={`Submitted ${formatDate(ip.created_at)}`} actions={ip.status === "approved" ? <ButtonLink href="/instructor">Open instructor portal</ButtonLink> : null} />
      <div className="space-y-6">
        {ip.status === "pending" ? <Alert tone="info" title="Under review">Our team is reviewing your profile. You can update it below in the meantime.</Alert> : null}
        {ip.status === "approved" ? <Alert tone="success" title="Approved">You can now create courses in the instructor portal.</Alert> : null}
        {ip.status === "rejected" ? <Alert tone="danger" title="Not approved">{ip.review_notes ?? "Unfortunately your application was not approved at this time."}</Alert> : null}
        {ip.status === "suspended" ? <Alert tone="danger" title="Suspended">Your instructor access is suspended. Contact support for details.</Alert> : null}
        <Card className="p-6"><p className="mb-4 text-sm text-ink-muted">Status: <strong className="text-ink">{titleCase(ip.status)}</strong></p><InstructorApplicationForm existing={ip} /></Card>
      </div>
    </>
  );
}
