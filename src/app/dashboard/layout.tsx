import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import type { NavItem } from "@/components/app/sidebar-nav";
import { requireUser } from "@/lib/auth/dal";
import { getUnreadCount } from "@/lib/data/student";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard · Proofwork" }, robots: { index: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const unread = await getUnreadCount(user.id);
  const nav: NavItem[] = [
    { href: "/dashboard", label: "Overview", icon: "dashboard", exact: true },
    { href: "/dashboard/learning", label: "My courses", icon: "learning" },
    { href: "/dashboard/assignments", label: "Assignments", icon: "applications" },
    { href: "/dashboard/results", label: "Results", icon: "analytics" },
    { href: "/dashboard/submissions", label: "Submission history", icon: "pending" },
    { href: "/dashboard/resources", label: "Resources", icon: "resources" },
    { href: "/dashboard/payments", label: "Payments & receipts", icon: "payments" },
    { href: "/dashboard/notifications", label: "Notifications", icon: "notifications", badge: unread || undefined },
    { href: "/dashboard/settings", label: "Account settings", icon: "settings" },
  ];
  return (
    <AppShell user={user} nav={nav} title="Learning" unread={unread}>
      {children}
    </AppShell>
  );
}
