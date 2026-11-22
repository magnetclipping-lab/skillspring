import Link from "next/link";
import { Award, BadgeCheck, BookOpenCheck } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { isSupabaseConfigured } from "@/lib/env";
import { Alert } from "@/components/ui/primitives";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {!isSupabaseConfigured() ? (
            <Alert tone="warning" title="Preview mode" className="mb-6">
              Supabase isn&apos;t configured, so accounts can&apos;t be created here yet. See README → Supabase setup.
            </Alert>
          ) : null}
          {children}
        </div>
        <p className="text-center text-xs text-ink-muted">
          <Link href="/terms" className="hover:underline">Terms</Link> · <Link href="/privacy" className="hover:underline">Privacy</Link>
        </p>
      </div>
      <div className="hero-gradient relative hidden overflow-hidden lg:block">
        <div className="grid-fade absolute inset-0" aria-hidden />
        <div className="relative flex h-full flex-col justify-center px-16 text-white">
          <h2 className="max-w-md font-display text-4xl font-bold leading-tight text-white">Learn skills. Build experience. Shape your future.</h2>
          <ul className="mt-10 max-w-md space-y-4">
            {[
              { icon: BookOpenCheck, t: "Structured courses with assignments and quizzes" },
              { icon: Award, t: "Certificates issued only after verified completion" },
              { icon: BadgeCheck, t: "Clearly labelled internships and project experiences" },
            ].map(({ icon: Icon, t }) => (
              <li key={t} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3.5 text-[15px] text-brand-50 ring-1 ring-white/10">
                <Icon className="size-5 text-brand-300" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
