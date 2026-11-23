import type { Metadata } from "next";
import Link from "next/link";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Free to join. Pay only for the courses you choose.</p>
      <RegisterForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have an account? <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-300 hover:underline">Log in</Link>
      </p>
    </>
  );
}
