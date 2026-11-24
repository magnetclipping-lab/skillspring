import Link from "next/link";
import { Bell } from "lucide-react";
import { LogoGlyph, Wordmark } from "@/components/site/logo";
import { UserMenu } from "@/components/site/user-menu";
import type { SessionUser } from "@/lib/auth/dal";
import { SidebarNav, type NavItem } from "./sidebar-nav";

export function AppShell({ user, nav, title, unread = 0, children }: { user: SessionUser; nav: NavItem[]; title: string; unread?: number; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-line bg-surface lg:flex lg:flex-col">
        <div className="flex h-16 items-center border-b border-line px-5"><Link href="/dashboard" className="flex items-center gap-2" aria-label="Proofwork dashboard"><LogoGlyph /><Wordmark className="text-[17px]" /></Link></div>
        <p className="px-5 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{title}</p>
        <SidebarNav items={nav} />
        <div className="mt-auto border-t border-line p-4 text-[12px] text-ink-muted">
          <Link href="/" className="hover:text-white">← Back to website</Link>
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 glass border-b border-line px-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden" aria-label="Proofwork dashboard"><LogoGlyph /><Wordmark className="text-[17px]" /></Link>
          <p className="hidden font-display text-[15px] font-semibold text-ink lg:block">{title}</p>
          <div className="flex items-center gap-1">
            <Link href="/dashboard/notifications" className="relative grid size-10 place-items-center rounded-md text-ink-soft hover:bg-white/[0.06]" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
              <Bell className="size-5" />
              {unread ? <span className="absolute right-2 top-2 grid min-w-4 place-items-center rounded bg-violet-500 px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span> : null}
            </Link>
            <UserMenu name={user.profile.full_name || user.email} email={user.email} isAdmin={user.roles.includes("admin")} isInstructor={user.instructor?.status === "approved"} />
          </div>
        </header>
        <div className="border-b border-line bg-surface px-2 py-2 lg:hidden">
          <SidebarNav items={nav} horizontal />
        </div>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
