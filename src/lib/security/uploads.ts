/**
 * Upload validation: size limits, extension allow-lists and magic-byte sniffing,
 * so a renamed executable cannot pass as a PDF. Pure functions (unit tested).
 */

export type UploadKind = "avatar" | "thumbnail" | "resume" | "assignment" | "resource" | "preview" | "poster";

type Rule = { bucket: string; maxBytes: number; types: string[]; public: boolean };

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

export const UPLOAD_RULES: Record<UploadKind, Rule> = {
  avatar: { bucket: "avatars", maxBytes: 2 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"], public: true },
  thumbnail: { bucket: "course-thumbnails", maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"], public: true },
  resume: { bucket: "resumes", maxBytes: 5 * 1024 * 1024, types: ["application/pdf"], public: false },
  assignment: {
    bucket: "assignment-submissions",
    maxBytes: 20 * 1024 * 1024,
    types: ["application/pdf", "image/jpeg", "image/png", "application/zip", "text/csv", "text/plain", XLSX, DOCX, PPTX],
    public: false,
  },
  resource: {
    bucket: "course-resources",
    maxBytes: 25 * 1024 * 1024,
    types: ["application/pdf", "image/jpeg", "image/png", "application/zip", "text/csv", "text/plain", XLSX, DOCX, PPTX],
    public: false,
  },
  preview: { bucket: "course-previews", maxBytes: 50 * 1024 * 1024, types: ["video/mp4", "video/webm", "video/quicktime"], public: true },
  poster: { bucket: "course-previews", maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"], public: true },
};

export const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/zip": "zip",
  "text/csv": "csv",
  "text/plain": "txt",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  [XLSX]: "xlsx",
  [DOCX]: "docx",
  [PPTX]: "pptx",
};

const OFFICE_BY_EXT: Record<string, string> = { xlsx: XLSX, docx: DOCX, pptx: PPTX };

export function extOf(name: string) {
  const e = (name.toLowerCase().split(".").pop() ?? "").trim();
  return e === "jpeg" ? "jpg" : e;
}

/** Looks like plain text: no NUL bytes and no other C0 controls except tab/CR/LF. */
function looksLikeText(b: Uint8Array) {
  if (!b.length) return false;
  for (const x of b) if (x === 0 || (x < 9) || (x > 13 && x < 32 && x !== 27)) return false;
  return true;
}

/** Detects the real file type from its first bytes. Office files are ZIP containers. */
export function sniffMime(bytes: Uint8Array, declared: string, name = ""): string | null {
  const b = bytes;
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (starts(0x1a, 0x45, 0xdf, 0xa3)) return "video/webm";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    // ISO base media: "ftyp" box. "qt  " brand is QuickTime.
    return b[8] === 0x71 && b[9] === 0x74 ? "video/quicktime" : "video/mp4";
  }
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    // ZIP container: an Office type only if declared or named as one we allow.
    if (declared.startsWith("application/vnd.openxmlformats-officedocument")) return declared;
    return OFFICE_BY_EXT[extOf(name)] ?? "application/zip";
  }
  const ext = extOf(name);
  if ((ext === "csv" || ext === "txt" || declared === "text/csv" || declared === "text/plain") && looksLikeText(b)) {
    return ext === "csv" || declared === "text/csv" ? "text/csv" : "text/plain";
  }
  return null;
}

export type ValidationResult = { ok: true; mime: string; ext: string } | { ok: false; error: string };

export function allowedLabel(kind: UploadKind) {
  return [...new Set(UPLOAD_RULES[kind].types.map((t) => EXT[t]?.toUpperCase()))].join(", ");
}

/** Pre-upload check on declared metadata (used before issuing a signed upload URL). */
export function precheckUpload(kind: UploadKind, file: { size: number; name: string }): { ok: true } | { ok: false; error: string } {
  const rule = UPLOAD_RULES[kind];
  if (!rule) return { ok: false, error: "Unknown upload type." };
  if (!(file.size > 0)) return { ok: false, error: "The file is empty." };
  if (file.size > rule.maxBytes) return { ok: false, error: `File is too large. Maximum size is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.` };
  const ext = extOf(file.name);
  if (!rule.types.some((t) => EXT[t] === ext)) return { ok: false, error: `Unsupported file type. Allowed: ${allowedLabel(kind)}.` };
  return { ok: true };
}

export function validateUpload(kind: UploadKind, file: { size: number; type: string; name: string }, head: Uint8Array): ValidationResult {
  const pre = precheckUpload(kind, file);
  if (!pre.ok) return pre;
  const rule = UPLOAD_RULES[kind];
  const sniffed = sniffMime(head, file.type, file.name);
  if (!sniffed || !rule.types.includes(sniffed)) {
    return { ok: false, error: `Unsupported file type. Allowed: ${allowedLabel(kind)}.` };
  }
  return { ok: true, mime: sniffed, ext: EXT[sniffed] };
}
