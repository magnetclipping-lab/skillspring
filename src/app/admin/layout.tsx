import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import type { NavItem } from "@/components/app/sidebar-nav";
import { requireAdmin } from "@/lib/auth/dal";
import { getUnreadCount } from "@/lib/data/student";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Proofwork" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const supabase = await createClient();
  const [unread, { count: reviewCount }] = await Promise.all([
    getUnreadCount(user.id),
    supabase.from("assignment_submissions").select("id", { count: "exact", head: true }).in("eval_status", ["needs_review", "failed"]),
  ]);
  const nav: NavItem[] = [
    { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
    { href: "/admin/courses", label: "Courses", icon: "courses" },
    { href: "/admin/submissions", label: "Review queue", icon: "review", badge: reviewCount || undefined },
    { href: "/admin/students", label: "Students", icon: "students" },
    { href: "/admin/instructors", label: "Instructors", icon: "instructors" },
    { href: "/admin/finance", label: "Revenue & payments", icon: "finance" },
    { href: "/admin/ambassadors", label: "Ambassadors", icon: "ambassadors" },
    { href: "/admin/messages", label: "Messages", icon: "inbox" },
    { href: "/admin/audit", label: "Audit log", icon: "audit" },
  ];
  return <AppShell user={user} nav={nav} title="Administration" unread={unread}>{children}</AppShell>;
}
