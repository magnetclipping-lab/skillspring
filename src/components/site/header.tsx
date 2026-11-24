import Link from "next/link";
import { getSessionUser } from "@/lib/auth/dal";
import { isSupabaseConfigured } from "@/lib/env";
import { getCategories, getPublishedCourses } from "@/lib/data/catalogue";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { CoursesMenu, type MenuCategory } from "./courses-menu";
import { UserMenu } from "./user-menu";

export const NAV = [
  { href: "/#method", label: "How it works" },
  { href: "/#assignments", label: "Assignments" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export async function SiteHeader() {
  const [user, categories, courses] = await Promise.all([getSessionUser(), getCategories(), getPublishedCourses()]);
  const configured = isSupabaseConfigured();
  const menu: MenuCategory[] = categories.map((c) => ({
    slug: c.slug, name: c.name, tagline: c.tagline ?? null, accent: c.accent ?? null,
    courses: courses.filter((x) => x.category?.slug === c.slug).map((x) => ({ slug: x.slug, title: x.title.split(" — ")[0] })),
  }));
  return (
    <header className="glass sticky top-0 z-40 border-b border-line">
      {!configured ? (
        <div className="border-b border-cyan-400/15 bg-cyan-400/[0.06] px-4 py-1.5 text-center text-[12.5px] font-medium text-cyan-300">
          Preview mode: Supabase isn&apos;t configured, so sign-in and purchases are off.
        </div>
      ) : null}
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
            <CoursesMenu categories={menu} />
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-md px-3 py-2 text-[14.5px] font-medium text-ink-soft transition-colors hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <UserMenu name={user.profile.full_name || user.email} email={user.email} isAdmin={user.roles.includes("admin")} isInstructor={user.instructor?.status === "approved"} />
          ) : (
            <>
              <Link href="/login" className="hidden rounded-md px-3 py-2 text-[14.5px] font-medium text-ink-soft hover:text-ink sm:inline-flex">Log in</Link>
              <Link href="/courses" className="btn-primary hidden h-10 px-4 text-[14px] sm:inline-flex">Browse courses</Link>
            </>
          )}
          <MobileNav
            items={[
              { href: "/courses", label: "All courses" },
              ...menu.map((m) => ({ href: `/courses?category=${m.slug}`, label: m.name, indent: true })),
              ...NAV,
            ]}
            signedIn={Boolean(user)}
          />
        </div>
      </div>
    </header>
  );
}
