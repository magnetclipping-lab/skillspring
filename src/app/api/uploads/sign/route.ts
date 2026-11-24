import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security/request";
import { rateLimit } from "@/lib/security/rate-limit";
import { EXT, UPLOAD_RULES, extOf, precheckUpload, type UploadKind } from "@/lib/security/uploads";
import { uploadFolder } from "@/lib/uploads/folders";

/**
 * Issues a one-time signed upload URL so large files (assignment files up to 20 MB,
 * preview videos up to 50 MB) go straight from the browser to Storage, bypassing the
 * serverless body limit. The URL is created with the caller's session, so Storage RLS
 * decides whether they may write to that folder. The file's real type is verified by
 * /api/uploads/finalize before it can be used.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (user.profile.is_suspended) return NextResponse.json({ error: "Account suspended." }, { status: 403 });
  if (!(await rateLimit("upload", user.id)).ok) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { kind?: string; courseId?: string; fileName?: string; size?: number } | null;
  const kind = String(body?.kind ?? "") as UploadKind;
  if (!(kind in UPLOAD_RULES)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  const pre = precheckUpload(kind, { size: Number(body?.size ?? 0), name: String(body?.fileName ?? "") });
  if (!pre.ok) return NextResponse.json({ error: pre.error }, { status: 400 });
  const f = uploadFolder(kind, user.id, String(body?.courseId ?? ""));
  if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });

  const ext = extOf(String(body?.fileName));
  if (!Object.values(EXT).includes(ext)) return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  const path = `${f.folder}/${randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(UPLOAD_RULES[kind].bucket).createSignedUploadUrl(path);
  if (error || !data) {
    const denied = /row-level|policy|unauthor|403/i.test(error?.message ?? "");
    return NextResponse.json({ error: denied ? "You don't have permission to upload here." : "Could not start the upload." }, { status: denied ? 403 : 500 });
  }
  return NextResponse.json({ path, signedUrl: data.signedUrl, token: data.token, bucket: UPLOAD_RULES[kind].bucket });
}
