import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/security/rate-limit";
import { parseTemplatePath, readBundledTemplate, TEMPLATE_MIME } from "@/lib/assessment/templates";

/**
 * Downloads an assignment's template (workbook or Word brief). RLS on assignments
 * decides whether the caller can see the assignment (active enrolment, course editor
 * or admin); unenrolled visitors get 404.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!(await rateLimit("template", user.id)).ok) return NextResponse.json({ error: "Too many downloads. Try again later." }, { status: 429 });

  const supabase = await createClient();
  const { data: a } = await supabase.from("assignments").select("id, template_path, template_name").eq("id", id).maybeSingle();
  const ref = parseTemplatePath(a?.template_path);
  if (!a || !ref) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const filename = (a.template_name || `template.${ref.ext}`).replace(/[^\w.\- ]/g, "_");

  if (ref.kind === "bundled") {
    const bytes = await readBundledTemplate(ref).catch(() => null);
    if (!bytes) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": TEMPLATE_MIME[ref.ext] ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const { data, error } = await createAdminClient().storage.from("course-resources").createSignedUrl(ref.path, 60, { download: filename });
  if (error || !data) return NextResponse.json({ error: "File unavailable" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
