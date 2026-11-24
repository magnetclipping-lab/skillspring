import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" updated="22 November 2026">
      <h2>Educational content only</h2>
      <p>Courses in financial modelling, business analysis, marketing and entrepreneurship are for educational purposes only and are not investment, tax, legal or financial advice. Proofwork is not a SEBI-registered investment adviser or research analyst.</p>
      <h2>No placement guarantee</h2>
      <p>Proofwork does not guarantee jobs, placements, interviews, salaries or admissions, and has no hiring partnerships. Outcomes depend on many factors outside our control.</p>
      <h2>Completion records and evaluation</h2>
      <p>Proofwork completion records are internal records of course completion. They are not accredited qualifications and are not endorsed by any university, employer or regulator. Assignment evaluation is AI-assisted and may be reviewed and adjusted by the Proofwork team.</p>
      <h2>Demo content</h2>
      <p>Listings marked “Demo” are previews of planned courses and are not available for purchase.</p>
      <h2>Third-party services</h2>
      <p>We rely on third-party providers (such as Razorpay, Supabase and video and email providers). Their services are governed by their own terms.</p>
    </LegalPage>
  );
}
