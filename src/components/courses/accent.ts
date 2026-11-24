/** Category accent → class names. Accent names come from categories.accent. */
const MAP: Record<string, { dot: string; text: string; border: string; tint: string; hex: string }> = {
  violet: { dot: "bg-cat-violet", text: "text-cat-violet", border: "border-cat-violet/40", tint: "bg-violet-tint", hex: "#8d76ff" },
  cyan: { dot: "bg-cat-cyan", text: "text-cat-cyan", border: "border-cat-cyan/40", tint: "bg-cyan-tint", hex: "#55d6e8" },
  blue: { dot: "bg-cat-blue", text: "text-cat-blue", border: "border-cat-blue/40", tint: "bg-[#111a33]", hex: "#6f9bff" },
  emerald: { dot: "bg-cat-emerald", text: "text-cat-emerald", border: "border-cat-emerald/40", tint: "bg-[#0c241a]", hex: "#3dd68c" },
  amber: { dot: "bg-cat-amber", text: "text-cat-amber", border: "border-cat-amber/40", tint: "bg-[#2a1f0c]", hex: "#f5b94a" },
};
const get = (a: string | null | undefined) => MAP[a ?? ""] ?? MAP.violet;
export const accentDot = (a?: string | null) => get(a).dot;
export const accentText = (a?: string | null) => get(a).text;
export const accentBorder = (a?: string | null) => get(a).border;
export const accentTint = (a?: string | null) => get(a).tint;
export const accentHex = (a?: string | null) => get(a).hex;
