import type { UploadKind } from "@/lib/security/uploads";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Storage folder for an upload. Storage RLS re-checks that the caller may write there. */
export function uploadFolder(kind: UploadKind, userId: string, courseId: string): { ok: true; folder: string } | { ok: false; error: string } {
  if (kind === "avatar" || kind === "resume") return { ok: true, folder: userId };
  if (!UUID.test(courseId)) return { ok: false, error: "Missing course." };
  if (kind === "assignment") return { ok: true, folder: `${userId}/${courseId}` };
  return { ok: true, folder: courseId };
}

/** Whether a storage path belongs to the folder this caller would be given (prevents finalising others' paths). */
export function pathInFolder(path: string, folder: string) {
  return path.startsWith(folder + "/") && !path.includes("..") && path.split("/").length === folder.split("/").length + 1;
}
