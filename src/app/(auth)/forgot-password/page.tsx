import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "../forms";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Forgot your password?</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Enter your email and we&apos;ll send you a secure reset link.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm"><Link href="/login" className="font-semibold text-brand-600 hover:underline">Back to log in</Link></p>
    </>
  );
}
