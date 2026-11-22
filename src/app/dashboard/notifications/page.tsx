import Link from "next/link";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { markNotificationsReadAction } from "@/lib/actions/learning";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/form";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser("/dashboard/notifications");
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  const unread = (data ?? []).some((n) => !n.read_at);
  return (
    <>
      <PageHeader title="Notifications" actions={unread ? <form action={markNotificationsReadAction}><SubmitButton variant="secondary" pendingText="Marking…">Mark all as read</SubmitButton></form> : null} />
      {data?.length ? (
        <Card><ul className="divide-y divide-line">
          {data.map((n) => (
            <li key={n.id} className={n.read_at ? "" : "bg-brand-50/40"}>
              <Link href={n.link ?? "/dashboard"} className="flex gap-3 px-5 py-4 hover:bg-slate-50">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand-600"}`} />
                <div className="min-w-0"><p className="font-medium">{n.title}</p>{n.body ? <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p> : null}<p className="mt-1 text-[12px] text-ink-muted">{formatDate(n.created_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p></div>
              </Link>
            </li>
          ))}
        </ul></Card>
      ) : <EmptyState icon={<Bell className="size-5" />} title="No notifications" description="Updates about enrolments, certificates and applications will show up here." />}
    </>
  );
}
