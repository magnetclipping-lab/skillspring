import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const BUNDLED = /^bundled:([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*\.(?:xlsx|docx|pptx|csv|pdf))$/;

export const TEMPLATE_MIME: Record<string, string> = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  pdf: "application/pdf",
};

/**
 * Assignment templates are either bundled with the app ("bundled:<course-slug>/<file>",
 * stored in private/templates, never in public/) or uploaded by an admin to the private
 * course-resources bucket ("storage:<path>").
 */
export type TemplateRef = { kind: "bundled"; file: string; name: string; ext: string } | { kind: "storage"; path: string; ext: string };

export function parseTemplatePath(p: string | null | undefined): TemplateRef | null {
  if (!p) return null;
  const m = BUNDLED.exec(p);
  if (m) return { kind: "bundled", file: join(process.cwd(), "private", "templates", m[1], m[2]), name: m[2], ext: m[2].split(".").pop()! };
  if (p.startsWith("storage:")) {
    const path = p.slice(8);
    if (!path || path.includes("..")) return null;
    return { kind: "storage", path, ext: path.split(".").pop()?.toLowerCase() ?? "" };
  }
  return null;
}

export async function readBundledTemplate(ref: Extract<TemplateRef, { kind: "bundled" }>) {
  return readFile(ref.file);
}
