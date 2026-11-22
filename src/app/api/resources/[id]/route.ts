import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Downloads a lesson resource. RLS on lesson_resources decides whether the caller
 * may see the row (enrolled / owner / admin); only then is a 60-second signed URL issued.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const supabase = await createClient();
  const { data: res } = await supabase.from("lesson_resources").select("storage_path, external_url, title").eq("id", id).maybeSingle();
  if (!res) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (res.external_url) return NextResponse.redirect(res.external_url);

  const { data, error } = await createAdminClient().storage.from("course-resources").createSignedUrl(res.storage_path!, 60, { download: res.title });
  if (error || !data) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
