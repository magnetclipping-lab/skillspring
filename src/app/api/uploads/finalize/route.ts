import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security/request";
import { UPLOAD_RULES, allowedLabel, sniffMime, type UploadKind } from "@/lib/security/uploads";
import { pathInFolder, uploadFolder } from "@/lib/uploads/folders";

/**
 * Verifies a file uploaded through a signed URL: reads its first bytes and checks the
 * real type. Files that fail are deleted. Only then is the path returned for use.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { kind?: string; courseId?: string; path?: string; fileName?: string } | null;
  const kind = String(body?.kind ?? "") as UploadKind;
  const path = String(body?.path ?? "");
  if (!(kind in UPLOAD_RULES)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });
  const f = uploadFolder(kind, user.id, String(body?.courseId ?? ""));
  if (!f.ok || !pathInFolder(path, f.folder)) return NextResponse.json({ error: "Invalid upload." }, { status: 400 });

  const rule = UPLOAD_RULES[kind];
  const supabase = await createClient();
  const { data: signed } = await supabase.storage.from(rule.bucket).createSignedUrl(path, 60);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  const res = await fetch(signed.signedUrl, { headers: { Range: "bytes=0-511" } }).catch(() => null);
  if (!res || !res.ok) return NextResponse.json({ error: "Upload not found." }, { status: 404 });
  const head = new Uint8Array(await res.arrayBuffer()).slice(0, 512);
  const mime = sniffMime(head, "", String(body?.fileName ?? path));
  if (!mime || !rule.types.includes(mime)) {
    await supabase.storage.from(rule.bucket).remove([path]);
    return NextResponse.json({ error: `That file isn't a valid ${allowedLabel(kind)} file.` }, { status: 400 });
  }
  const url = rule.public ? supabase.storage.from(rule.bucket).getPublicUrl(path).data.publicUrl : undefined;
  return NextResponse.json({ path, url, mime, bucket: rule.bucket });
}
