import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import type { NavItem } from "@/components/app/sidebar-nav";
import { requireUser } from "@/lib/auth/dal";
import { getUnreadCount } from "@/lib/data/student";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard · SkillSpring" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const unread = await getUnreadCount(user.id);
  const nav: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "dashboard", exact: true },
    { href: "/dashboard/learning", label: "My learning", icon: "learning" },
    { href: "/dashboard/certificates", label: "Certificates", icon: "certificates" },
    { href: "/dashboard/applications", label: "Applications", icon: "applications" },
    { href: "/dashboard/saved", label: "Saved internships", icon: "saved" },
    { href: "/dashboard/payments", label: "Payments", icon: "payments" },
    { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", badge: unread || undefined },
    { href: "/dashboard/settings", label: "Account settings", icon: "settings" },
  ];
  return (
    <AppShell user={user} nav={nav} title="Student dashboard" unread={unread}>
      {children}
    </AppShell>
  );
}
