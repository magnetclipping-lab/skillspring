import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-ink-muted">Log in to continue learning.</p>
      {error ? <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">That link is invalid or has expired. Please try again.</p> : null}
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-ink-muted">
        New to SkillSpring? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-brand-600 hover:underline">Create an account</Link>
      </p>
    </>
  );
}
