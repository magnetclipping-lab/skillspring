import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/primitives";
import { InternshipForm } from "../form";
import type { Internship } from "@/lib/types";

export default async function EditInternship({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: i }, { data: employers }] = await Promise.all([supabase.from("internships").select("*").eq("id", id).maybeSingle(), supabase.from("employers").select("id, name, status").order("name")]);
  if (!i) notFound();
  return (<><Link href="/admin/internships" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-300 hover:underline"><ArrowLeft className="size-4" />Internships</Link><div className="mt-4"><PageHeader title={i.title} actions={<Link href={`/admin/applications?internship=${i.id}`} className="text-sm font-semibold text-brand-300 hover:underline">View applications →</Link>} /></div><Card className="p-6"><InternshipForm internship={i as Internship} employers={employers ?? []} /></Card></>);
}
