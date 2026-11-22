/**
 * Upload validation: size limits, extension allow-lists and magic-byte sniffing,
 * so a renamed executable cannot pass as a PDF. Pure functions (unit tested).
 */

export type UploadKind = "avatar" | "thumbnail" | "resume" | "assignment" | "resource";

type Rule = { bucket: string; maxBytes: number; types: string[]; public: boolean };

export const UPLOAD_RULES: Record<UploadKind, Rule> = {
  avatar: { bucket: "avatars", maxBytes: 2 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"], public: true },
  thumbnail: { bucket: "course-thumbnails", maxBytes: 3 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"], public: true },
  resume: { bucket: "resumes", maxBytes: 5 * 1024 * 1024, types: ["application/pdf"], public: false },
  assignment: {
    bucket: "assignment-submissions",
    maxBytes: 10 * 1024 * 1024,
    types: ["application/pdf", "image/jpeg", "image/png", "application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    public: false,
  },
  resource: {
    bucket: "course-resources",
    maxBytes: 25 * 1024 * 1024,
    types: ["application/pdf", "image/jpeg", "image/png", "application/zip", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    public: false,
  },
};

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/zip": "zip",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

/** Detects the real file type from its first bytes. Office files are ZIP containers. */
export function sniffMime(bytes: Uint8Array, declared: string): string | null {
  const b = bytes;
  const starts = (...sig: number[]) => sig.every((v, i) => b[i] === v);
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    // ZIP container: trust the declared Office type only if it is one we allow.
    return declared.startsWith("application/vnd.openxmlformats-officedocument") ? declared : "application/zip";
  }
  return null;
}

export type ValidationResult = { ok: true; mime: string; ext: string } | { ok: false; error: string };

export function validateUpload(kind: UploadKind, file: { size: number; type: string; name: string }, head: Uint8Array): ValidationResult {
  const rule = UPLOAD_RULES[kind];
  if (!rule) return { ok: false, error: "Unknown upload type." };
  if (file.size <= 0) return { ok: false, error: "The file is empty." };
  if (file.size > rule.maxBytes) return { ok: false, error: `File is too large. Maximum size is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.` };
  const sniffed = sniffMime(head, file.type);
  if (!sniffed || !rule.types.includes(sniffed)) {
    return { ok: false, error: `Unsupported file type. Allowed: ${rule.types.map((t) => EXT[t]?.toUpperCase()).join(", ")}.` };
  }
  return { ok: true, mime: sniffed, ext: EXT[sniffed] };
}
