import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Terms and conditions" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms and conditions" updated="22 November 2026">
      <p>These terms govern your use of Proofwork, operated by [legal entity name, registered address, CIN/GSTIN]. By creating an account you agree to them.</p>
      <h2>Accounts</h2>
      <ul><li>You must provide accurate information and keep your password secure.</li><li>Work you submit must be your own. Using AI tools is allowed where an assignment permits it, but you must not submit someone else's work as yours.</li><li>We may suspend accounts that breach these terms, share paid content, or misuse the platform.</li></ul>
      <h2>Courses and licence</h2>
      <p>Purchasing a course grants you a personal, non-transferable, non-commercial licence to access its content. You may not copy, record, resell or redistribute course material.</p>
      <h2>Assignments, evaluation and completion records</h2>
      <p>Assignments are evaluated against published rubrics. Evaluation is AI-assisted and may be reviewed by the Proofwork team, who may adjust marks. A completion record confirms that you met the course requirements on Proofwork. It is not an academic degree, professional qualification or accredited certificate. We may withdraw a completion record obtained through plagiarism or misuse.</p>
      <h2>Payments</h2>
      <p>Prices are shown in Indian Rupees. Payments are processed by Razorpay. Access is granted only after the payment is verified. Refunds are governed by our Refund Policy.</p>
      <h2>Instructors</h2>
      <p>Instructors warrant that they own or are licensed to use all material they upload and grant Proofwork the right to host and sell it under the agreed revenue share.</p>
      <h2>Liability</h2>
      <p>Course content is educational. Finance-related courses are not investment advice. To the extent permitted by law, our liability is limited to the amount you paid for the relevant course.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of India. Courts at [city] have jurisdiction.</p>
    </LegalPage>
  );
}
