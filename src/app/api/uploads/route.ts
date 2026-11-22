import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { UPLOAD_RULES, validateUpload, type UploadKind } from "@/lib/security/uploads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Authenticated file upload. Validates size + magic bytes, generates a random
 * object name inside the caller's (or course's) folder, and uploads with the
 * caller's session so Storage RLS policies are enforced as a second check.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.profile.is_suspended) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  if (!(await rateLimit("upload", user.id)).ok) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  const fd = await request.formData().catch(() => null);
  const file = fd?.get("file");
  const kind = String(fd?.get("kind") ?? "") as UploadKind;
  const courseId = String(fd?.get("courseId") ?? "");
  if (!(file instanceof File) || !(kind in UPLOAD_RULES)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const v = validateUpload(kind, file, head);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  let folder: string;
  if (kind === "avatar" || kind === "resume") folder = user.id;
  else if (kind === "assignment") {
    if (!UUID.test(courseId)) return NextResponse.json({ error: "Missing course." }, { status: 400 });
    folder = `${user.id}/${courseId}`;
  } else {
    if (!UUID.test(courseId)) return NextResponse.json({ error: "Missing course." }, { status: 400 });
    folder = courseId;
  }

  const rule = UPLOAD_RULES[kind];
  const path = `${folder}/${randomUUID()}.${v.ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from(rule.bucket).upload(path, file, { contentType: v.mime, upsert: false, cacheControl: rule.public ? "31536000" : "0" });
  if (error) {
    const denied = /row-level|policy|unauthor/i.test(error.message);
    return NextResponse.json({ error: denied ? "You don't have permission to upload here." : "Upload failed." }, { status: denied ? 403 : 500 });
  }
  const url = rule.public ? supabase.storage.from(rule.bucket).getPublicUrl(path).data.publicUrl : undefined;
  return NextResponse.json({ path, url, mime: v.mime, bucket: rule.bucket });
}
