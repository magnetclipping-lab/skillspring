"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Award, BarChart3, Bell, BookOpen, Bookmark, Briefcase, Building2, ClipboardList, CreditCard, FileClock, GraduationCap,
  Inbox, LayoutDashboard, Megaphone, ScrollText, Settings, Users, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  dashboard: LayoutDashboard, learning: BookOpen, certificates: Award, applications: ClipboardList, saved: Bookmark,
  payments: CreditCard, notifications: Bell, settings: Settings, courses: GraduationCap, students: Users,
  instructors: Users, internships: Briefcase, employers: Building2, finance: Wallet, audit: ScrollText, analytics: BarChart3,
  inbox: Inbox, pending: FileClock, ambassadors: Megaphone,
} as const;

export type NavItem = { href: string; label: string; icon: keyof typeof icons; exact?: boolean; badge?: number };

export function SidebarNav({ items, horizontal }: { items: NavItem[]; horizontal?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Section" className={cn(horizontal ? "flex gap-1 overflow-x-auto" : "flex flex-col gap-0.5 px-3")}>
      {items.map((it) => {
        const Icon = icons[it.icon];
        const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition",
              horizontal && "shrink-0 whitespace-nowrap",
              active ? "bg-brand-500/10 text-brand-300" : "text-ink-soft hover:bg-white/[0.03] hover:text-ink",
            )}
          >
            <Icon className={cn("size-4", active ? "text-brand-300" : "text-ink-muted")} />
            {it.label}
            {it.badge ? <span className="ml-auto rounded-full bg-brand-600 px-1.5 text-[10.5px] font-bold text-white">{it.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
