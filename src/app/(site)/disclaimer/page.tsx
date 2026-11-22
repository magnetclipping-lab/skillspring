import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer" updated="22 November 2026">
      <h2>Educational content only</h2>
      <p>Courses in finance, stock markets and investing are for educational purposes only and are not investment, tax or legal advice. SkillSpring is not a SEBI-registered investment adviser or research analyst. Markets involve risk; past performance does not indicate future results.</p>
      <h2>No placement guarantee</h2>
      <p>SkillSpring does not guarantee jobs, internships, interviews, salaries or admissions. Outcomes depend on many factors outside our control.</p>
      <h2>Internship listings</h2>
      <p>Employer internships are posted by verified employers who are responsible for their listings and selection decisions. Simulations and project experiences are run by SkillSpring for learning and are not employment.</p>
      <h2>Demo content</h2>
      <p>Listings marked “Demo” are previews of planned courses and are not available for purchase.</p>
      <h2>Third-party services</h2>
      <p>We rely on third-party providers (such as Razorpay, Supabase and video and email providers). Their services are governed by their own terms.</p>
    </LegalPage>
  );
}
