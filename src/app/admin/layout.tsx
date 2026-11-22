import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import type { NavItem } from "@/components/app/sidebar-nav";
import { requireAdmin } from "@/lib/auth/dal";
import { getUnreadCount } from "@/lib/data/student";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · SkillSpring" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const unread = await getUnreadCount(user.id);
  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
    { href: "/admin/courses", label: "Courses", icon: "courses" },
    { href: "/admin/students", label: "Students", icon: "students" },
    { href: "/admin/instructors", label: "Instructors", icon: "instructors" },
    { href: "/admin/internships", label: "Internships", icon: "internships" },
    { href: "/admin/applications", label: "Applications", icon: "applications" },
    { href: "/admin/ambassadors", label: "Ambassadors", icon: "ambassadors" },
    { href: "/admin/employers", label: "Employers", icon: "employers" },
    { href: "/admin/finance", label: "Finance", icon: "finance" },
    { href: "/admin/certificates", label: "Certificates", icon: "certificates" },
    { href: "/admin/messages", label: "Messages", icon: "inbox" },
    { href: "/admin/audit", label: "Audit log", icon: "audit" },
  ];
  return <AppShell user={user} nav={nav} title="Administration" unread={unread}>{children}</AppShell>;
}
