import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Signed access to private assignment files. Authorisation is decided by reading the
 * submission row through RLS (the learner, the course's instructor or an admin).
 * `version` downloads an earlier version from the submission history.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();

  if (type !== "submission") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bucket = "assignment-submissions";
  const version = Number(request.nextUrl.searchParams.get("version") ?? "");
  let path: string | null = null;
  let name: string | null = null;
  if (Number.isInteger(version) && version > 0) {
    const { data } = await supabase.from("submission_history").select("file_path, file_name").eq("submission_id", id).eq("version", version).maybeSingle();
    path = data?.file_path ?? null;
    name = data?.file_name ?? null;
  } else {
    const { data } = await supabase.from("assignment_submissions").select("file_path, file_name").eq("id", id).maybeSingle();
    path = data?.file_path ?? null;
    name = data?.file_name ?? null;
  }

  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(path, 60, name ? { download: name.replace(/[^\w.\- ]/g, "_") } : undefined);
  if (error || !data) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
