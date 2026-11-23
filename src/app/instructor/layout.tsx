import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import type { NavItem } from "@/components/app/sidebar-nav";
import { requireInstructor } from "@/lib/auth/dal";
import { getUnreadCount } from "@/lib/data/student";

export const metadata: Metadata = { title: { default: "Instructor portal", template: "%s · Instructor · Proofwork" }, robots: { index: false } };

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInstructor();
  const unread = await getUnreadCount(user.id);
  const nav: NavItem[] = [
    { href: "/instructor", label: "Overview", icon: "dashboard", exact: true },
    { href: "/instructor/courses", label: "My courses", icon: "courses" },
    { href: "/instructor/earnings", label: "Earnings & payouts", icon: "finance" },
    { href: "/dashboard/instructor-application", label: "Instructor profile", icon: "settings" },
    { href: "/dashboard", label: "Student dashboard", icon: "learning", exact: true },
  ];
  return <AppShell user={user} nav={nav} title="Instructor portal" unread={unread}>{children}</AppShell>;
}
