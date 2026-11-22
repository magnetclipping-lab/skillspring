import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Signed access to private uploads (resumes, assignment files).
 * Authorisation is decided by reading the owning record through RLS:
 *  - resumes: the application row must be visible to the caller (applicant, admin or verified employer member)
 *  - assignment files: the submission row must be visible (student, course instructor or admin)
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const type = request.nextUrl.searchParams.get("type");
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();

  let bucket: string, path: string | null = null;
  if (type === "resume") {
    bucket = "resumes";
    const { data } = await supabase.from("internship_applications").select("resume_path").eq("id", id).maybeSingle();
    path = data?.resume_path ?? null;
  } else if (type === "submission") {
    bucket = "assignment-submissions";
    const { data } = await supabase.from("assignment_submissions").select("file_path").eq("id", id).maybeSingle();
    path = data?.file_path ?? null;
  } else return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!path) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await createAdminClient().storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
