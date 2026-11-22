import { requireInstructor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { CourseForm } from "@/components/editor/forms";
import type { Category } from "@/lib/types";

export const metadata = { title: "New course" };

export default async function NewInstructorCourse() {
  await requireInstructor();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (
    <>
      <PageHeader title="Create a course" description="Start with the basics. You can add modules and lessons next." />
      <Card className="p-6"><CourseForm base="/instructor" categories={(data ?? []) as Category[]} /></Card>
    </>
  );
}
