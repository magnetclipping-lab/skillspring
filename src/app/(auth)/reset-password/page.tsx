import type { Metadata } from "next";
import { ResetForm } from "../forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">You&apos;ll stay signed in after updating it.</p>
      <ResetForm />
    </>
  );
}
