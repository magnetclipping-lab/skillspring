import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-display text-7xl font-extrabold text-brand-200">404</p>
      <h1 className="mt-2 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-ink-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-6 flex gap-3"><ButtonLink href="/">Go home</ButtonLink><ButtonLink href="/courses" variant="secondary">Browse courses</ButtonLink></div>
      <Link href="/contact" className="mt-6 text-sm text-brand-600 hover:underline">Contact support</Link>
    </main>
  );
}
