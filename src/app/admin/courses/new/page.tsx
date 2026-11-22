import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { CourseForm } from "@/components/editor/forms";
import type { Category } from "@/lib/types";

export const metadata = { title: "New course" };

export default async function AdminNewCourse() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (<><PageHeader title="Create a course" description="New courses start as drafts. Approve and publish them from the course page." /><Card className="p-6"><CourseForm base="/admin" categories={(data ?? []) as Category[]} /></Card></>);
}
