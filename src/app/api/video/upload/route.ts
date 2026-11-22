import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { isSameOrigin } from "@/lib/security/request";
import { createMuxDirectUpload } from "@/lib/video";
import { publicEnv } from "@/lib/env";

const body = z.object({ courseId: z.string().uuid() });

/** Returns a Mux direct-upload URL for course editors. The browser PUTs the file straight to Mux. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // Editing permission is checked by RLS: an editor can update the course row.
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, status, instructor_id").eq("id", parsed.data.courseId).maybeSingle();
  const isAdmin = user.roles.includes("admin");
  const canEdit = course && (isAdmin || (course.instructor_id === user.instructor?.id && ["draft", "changes_requested"].includes(course.status)));
  if (!canEdit) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const upload = await createMuxDirectUpload(publicEnv.siteUrl).catch((e) => { console.error(e); return undefined; });
  if (upload === null) return NextResponse.json({ error: "Mux is not configured (MUX_TOKEN_ID / MUX_TOKEN_SECRET)." }, { status: 503 });
  if (!upload) return NextResponse.json({ error: "Could not create upload." }, { status: 502 });
  return NextResponse.json({ uploadId: upload.id, url: upload.url, note: "After processing, copy the asset's signed playback ID into the lesson's video ID field." });
}
