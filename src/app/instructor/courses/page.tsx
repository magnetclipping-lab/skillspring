import Link from "next/link";
import { Plus } from "lucide-react";
import { requireInstructor } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Badge, EmptyState, PageHeader, Table } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { statusTone } from "@/components/editor/course-editor";
import { formatDate, formatINR, titleCase } from "@/lib/utils";

export const metadata = { title: "My courses" };

export default async function InstructorCourses() {
  const user = await requireInstructor();
  const supabase = await createClient();
  const { data } = await supabase.from("courses").select("id, title, status, price_paise, updated_at, rights_status").eq("instructor_id", user.instructor.id).order("updated_at", { ascending: false });
  return (
    <>
      <PageHeader title="My courses" description="Draft → submit for review → approved by Proofwork → published." actions={<ButtonLink href="/instructor/courses/new"><Plus className="size-4" />New course</ButtonLink>} />
      {data?.length ? (
        <Table>
          <thead><tr><th>Course</th><th>Status</th><th>Rights</th><th>Price</th><th>Updated</th></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c.id}><td><Link href={`/instructor/courses/${c.id}`} className="font-medium hover:text-white">{c.title}</Link></td><td><Badge tone={statusTone[c.status]}>{titleCase(c.status)}</Badge></td><td>{titleCase(c.rights_status)}</td><td>{formatINR(c.price_paise)}</td><td>{formatDate(c.updated_at)}</td></tr>
          ))}</tbody>
        </Table>
      ) : <EmptyState title="No courses yet" action={<ButtonLink href="/instructor/courses/new">Create your first course</ButtonLink>} />}
    </>
  );
}
