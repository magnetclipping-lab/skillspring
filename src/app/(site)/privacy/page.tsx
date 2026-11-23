import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";
import { publicEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="22 November 2026">
      <p>This policy explains how [Proofwork legal entity name] (“Proofwork”, “we”) collects and uses personal data when you use our website and services, in line with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.</p>
      <h2>Data we collect</h2>
      <ul><li>Account data: name, email address, password (stored as a secure hash by our authentication provider).</li><li>Profile data you choose to add: phone number, college, degree, graduation year, skills, photo.</li><li>Learning data: enrolments, lesson progress, quiz attempts, assignment submissions, certificates.</li><li>Internship applications: cover letters, resumes and links you submit.</li><li>Payment data: order and payment references and status from Razorpay. We never receive or store card numbers, CVV or UPI PINs.</li><li>Technical data: IP address (hashed for rate limiting), device and browser information, and essential cookies for sign-in.</li></ul>
      <h2>How we use it</h2>
      <ul><li>To provide courses, track progress and issue certificates.</li><li>To process payments, refunds and instructor payouts.</li><li>To share your application with the employer you apply to (employer internships only).</li><li>To send transactional emails (verification, receipts, certificate and application updates).</li><li>To keep the platform secure and prevent abuse.</li></ul>
      <h2>Sharing</h2>
      <p>We share data only with service providers needed to run Proofwork (hosting, database and authentication, payments, video delivery, email), with employers you apply to, and where required by law. Public certificate verification shows only the name on the certificate, course title, issue date and status.</p>
      <h2>Your rights</h2>
      <p>You may access, correct or request erasure of your personal data, withdraw consent and nominate a person to exercise your rights. Contact our Grievance Officer at <a href={`mailto:${publicEnv.supportEmail}`}>{publicEnv.supportEmail}</a>. We will respond within the timelines required by law.</p>
      <h2>Retention</h2>
      <p>We keep account and learning records while your account is active and as needed for legal, tax and certificate-verification purposes. Payment records are retained as required by applicable law.</p>
      <h2>Cookies</h2>
      <p>We use only essential cookies required for sign-in and security. We do not use advertising cookies.</p>
    </LegalPage>
  );
}
