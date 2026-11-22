/**
 * CSV serialisation with formula-injection protection: cells beginning with
 * = + - @ (or tab/CR) are prefixed with a quote so spreadsheets treat them as text.
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "﻿";
  const headers = Object.keys(rows[0]);
  return "﻿" + [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\r\n");
}
