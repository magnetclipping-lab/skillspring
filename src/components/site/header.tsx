import Link from "next/link";
import { getSessionUser } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";

export const NAV = [
  { href: "/courses", label: "Courses" },
  { href: "/internships", label: "Internships" },
  { href: "/become-instructor", label: "Teach" },
  { href: "/partners", label: "Partners" },
  { href: "/about", label: "About" },
];

export async function SiteHeader() {
  const user = await getSessionUser();
  const configured = isSupabaseConfigured();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-white/85 backdrop-blur-lg">
      {!configured ? (
        <div className="bg-amber-50 px-4 py-1.5 text-center text-[12.5px] font-medium text-amber-900">
          Preview mode — Supabase is not configured, so sign-in and purchases are disabled. Showing demo catalogue data.
        </div>
      ) : null}
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-brand-50 hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu
              name={user.profile.full_name || user.email}
              email={user.email}
              isAdmin={user.roles.includes("admin")}
              isInstructor={user.instructor?.status === "approved"}
            />
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" className="hidden sm:inline-flex">
                Log in
              </ButtonLink>
              <ButtonLink href="/register" className="hidden sm:inline-flex">
                Get started
              </ButtonLink>
            </>
          )}
          <MobileNav items={NAV} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
