import Link from "next/link";
import { getSessionUser } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { PROGRAMS } from "@/lib/programs";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { ProgramsMenu } from "./programs-menu";
import { UserMenu } from "./user-menu";

export const NAV = [
  { href: "/internships", label: "Internships" },
  { href: "/campus-ambassador", label: "Campus Ambassador", badge: "Free" },
  { href: "/about", label: "About" },
];

export async function SiteHeader() {
  const user = await getSessionUser();
  const configured = isSupabaseConfigured();
  const menu = PROGRAMS.map((p) => ({ slug: p.slug, name: p.shortName, pitch: p.pitch, hue: p.hue, duration: p.duration }));
  return (
    <header className="sticky top-0 z-40 border-b border-ink/8 bg-canvas/85 backdrop-blur-xl">
      {!configured ? (
        <div className="bg-amber-50 px-4 py-1.5 text-center text-[12.5px] font-medium text-amber-900">
          Preview mode: Supabase isn&apos;t configured, so sign-in and purchases are off. Showing sample data.
        </div>
      ) : null}
      <div className="container-page flex h-[68px] items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            <ProgramsMenu programs={menu} />
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="flex items-center gap-2 rounded-full px-3.5 py-2 text-[14.5px] font-medium text-ink-soft transition-colors hover:bg-white hover:text-ink">
                {n.label}
                {n.badge ? <span className="rounded-full bg-marigold-100 px-2 py-0.5 text-[11px] font-semibold text-marigold-600">{n.badge}</span> : null}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu name={user.profile.full_name || user.email} email={user.email} isAdmin={user.roles.includes("admin")} isInstructor={user.instructor?.status === "approved"} />
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-4 py-2 text-[14.5px] font-medium text-ink-soft hover:text-ink sm:inline-flex">Log in</Link>
              <ButtonLink href="/register" className="hidden rounded-full bg-ink px-5 hover:bg-brand-800 sm:inline-flex">Get started</ButtonLink>
            </>
          )}
          <MobileNav items={[{ href: "/programs", label: "All programs" }, ...menu.map((m) => ({ href: `/programs/${m.slug}`, label: m.name, indent: true })), ...NAV]} signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
