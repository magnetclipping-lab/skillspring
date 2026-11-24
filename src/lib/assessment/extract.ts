import "server-only";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import JSZip from "jszip";

/**
 * Turns a submitted file into something an evaluator can read.
 *  - XLSX: every sheet's used range, with each cell's formula (if any) and its value, so the
 *    evaluator can tell live formulas from typed numbers.
 *  - DOCX: plain text (mammoth).
 *  - PPTX: slide text from the slide XML.
 *  - CSV/TXT: text.
 *  - PDF, PNG, JPG: passed to the model natively as document/image blocks.
 *  - ZIP: file listing only (contents are not opened); flagged for human review.
 */
export type Extracted =
  | { kind: "text"; label: string; text: string; truncated: boolean; notes: string[] }
  | { kind: "pdf"; base64: string; notes: string[] }
  | { kind: "image"; mediaType: "image/png" | "image/jpeg"; base64: string; notes: string[] }
  | { kind: "unsupported"; notes: string[] };

const MAX_TEXT = 60_000;
const MAX_CELLS_PER_SHEET = 2_500;

function cap(text: string) {
  return text.length > MAX_TEXT ? { text: text.slice(0, MAX_TEXT), truncated: true } : { text, truncated: false };
}

function cellValue(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if ("formula" in v || "sharedFormula" in v) {
      const r = (v as ExcelJS.CellFormulaValue).result;
      return r == null ? "" : typeof r === "object" && "error" in (r as object) ? String((r as { error: string }).error) : String(r);
    }
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as { text: string }).text);
    if ("error" in v) return String((v as { error: string }).error);
    return JSON.stringify(v);
  }
  return String(v);
}

export async function extractXlsx(buf: Buffer): Promise<Extracted> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const out: string[] = [];
  let formulas = 0;
  let values = 0;
  const notes: string[] = [];
  wb.eachSheet((ws) => {
    out.push(`### Sheet "${ws.name}" (${ws.rowCount} rows × ${ws.columnCount} columns)`);
    let n = 0;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (n >= MAX_CELLS_PER_SHEET) return;
        const f = cell.formula;
        const val = cellValue(cell.value);
        if (f) {
          formulas++;
          out.push(`${cell.address}: =${f} → ${val}`);
        } else if (val !== "") {
          values++;
          out.push(`${cell.address}: ${val}`);
        }
        n++;
      });
    });
    if (n >= MAX_CELLS_PER_SHEET) notes.push(`Sheet "${ws.name}" has more than ${MAX_CELLS_PER_SHEET} cells; only the first ${MAX_CELLS_PER_SHEET} were included.`);
  });
  notes.push(`Workbook contains ${formulas} formula cells and ${values} value cells.`);
  const { text, truncated } = cap(out.join("\n"));
  return { kind: "text", label: "Excel workbook (cell: formula → value)", text, truncated, notes };
}

export async function extractDocx(buf: Buffer): Promise<Extracted> {
  const r = await mammoth.extractRawText({ buffer: buf });
  const { text, truncated } = cap(r.value.trim());
  return { kind: "text", label: "Word document text", text, truncated, notes: r.messages.length ? ["Some formatting could not be read."] : [] };
}

export async function extractPptx(buf: Buffer): Promise<Extracted> {
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const parts: string[] = [];
  for (const [i, f] of slides.entries()) {
    const xml = await zip.file(f)!.async("string");
    const text = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(" ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    parts.push(`### Slide ${i + 1}\n${text}`);
  }
  const { text, truncated } = cap(parts.join("\n\n"));
  return { kind: "text", label: "PowerPoint slide text", text, truncated, notes: ["Only slide text is included; charts and images in slides are not visible to the evaluator."] };
}

export async function extractZipListing(buf: Buffer): Promise<Extracted> {
  const zip = await JSZip.loadAsync(buf);
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir).slice(0, 200);
  return { kind: "text", label: "ZIP archive listing (contents not opened)", text: names.join("\n"), truncated: false, notes: ["ZIP contents are not evaluated automatically; a reviewer will check them."] };
}

export async function extractFile(buf: Buffer, fileName: string): Promise<Extracted> {
  const ext = (fileName.toLowerCase().split(".").pop() ?? "").trim();
  switch (ext) {
    case "xlsx": return extractXlsx(buf);
    case "docx": return extractDocx(buf);
    case "pptx": return extractPptx(buf);
    case "csv":
    case "txt": {
      const { text, truncated } = cap(buf.toString("utf8"));
      return { kind: "text", label: ext === "csv" ? "CSV file" : "Text file", text, truncated, notes: ext === "csv" ? ["CSV files contain values only; formulas cannot be checked."] : [] };
    }
    case "pdf": return { kind: "pdf", base64: buf.toString("base64"), notes: [] };
    case "png": return { kind: "image", mediaType: "image/png", base64: buf.toString("base64"), notes: [] };
    case "jpg":
    case "jpeg": return { kind: "image", mediaType: "image/jpeg", base64: buf.toString("base64"), notes: [] };
    case "zip": return extractZipListing(buf);
    default: return { kind: "unsupported", notes: [`Files of type .${ext} can't be read automatically.`] };
  }
}
