import { Bookmark } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { InternshipCard } from "@/components/site/cards";
import type { Internship } from "@/lib/types";

export const metadata = { title: "Saved internships" };

export default async function SavedPage() {
  const user = await requireUser("/dashboard/saved");
  const supabase = await createClient();
  const { data } = await supabase.from("saved_internships").select("internship:internships(*, employer:employers(name, slug, website, logo_url, status))").eq("user_id", user.id).order("created_at", { ascending: false });
  const list = ((data ?? []) as unknown as { internship: Internship | null }[]).map((r) => r.internship).filter(Boolean) as Internship[];
  return (
    <>
      <PageHeader title="Saved internships" />
      {list.length ? <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{list.map((i) => <InternshipCard key={i.id} internship={i} />)}</div>
        : <EmptyState icon={<Bookmark className="size-5" />} title="Nothing saved yet" description="Save opportunities to come back to them later." action={<ButtonLink href="/internships">Browse opportunities</ButtonLink>} />}
    </>
  );
}
