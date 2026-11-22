import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { InternshipForm } from "../form";

export const metadata = { title: "New internship" };

export default async function NewInternship() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("employers").select("id, name, status").order("name");
  return (<><PageHeader title="New listing" description="Only link real employers that you have verified. Use “simulation” or “project” for SkillSpring-run experiences." /><Card className="p-6"><InternshipForm employers={data ?? []} /></Card></>);
}
