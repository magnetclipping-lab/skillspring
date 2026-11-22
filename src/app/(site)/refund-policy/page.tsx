import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/site/legal";

export const metadata: Metadata = { title: "Refund policy" };

export default function RefundPolicyPage() {
  return (
    <LegalPage title="Refund policy" updated="22 November 2026">
      <p>We want you to be happy with your purchase. Please read the conditions below. [Confirm the refund window and conditions with your business and legal advisers.]</p>
      <h2>Eligibility</h2>
      <ul><li>Refund requests can be made within <strong>7 days</strong> of purchase.</li><li>You must have completed less than <strong>25%</strong> of the course and must not have claimed a certificate.</li><li>Duplicate payments for the same course are always refunded in full.</li></ul>
      <h2>How to request</h2>
      <p>Use the <Link href="/contact?topic=refund">contact form</Link> and choose “Refund request”, including your payment reference from the Payments page in your dashboard.</p>
      <h2>Processing</h2>
      <ul><li>Approved refunds are issued through Razorpay to the original payment method.</li><li>Banks typically take 5–7 working days to credit the amount.</li><li>Course access ends once a full refund is processed.</li></ul>
      <h2>Failed payments</h2>
      <p>If money was deducted but the payment failed, it is normally reversed automatically by your bank or Razorpay. Contact us if it does not appear within 7 working days.</p>
    </LegalPage>
  );
}
