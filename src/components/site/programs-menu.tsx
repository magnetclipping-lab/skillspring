"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { ProgramHue } from "@/lib/programs";
import { cn } from "@/lib/utils";

const dot: Record<ProgramHue, string> = { stock: "bg-stock", web: "bg-web", digital: "bg-digital", excel: "bg-excel" };
const tint: Record<ProgramHue, string> = { stock: "group-hover:bg-stock-tint", web: "group-hover:bg-web-tint", digital: "group-hover:bg-digital-tint", excel: "group-hover:bg-excel-tint" };

export function ProgramsMenu({ programs }: { programs: { slug: string; name: string; pitch: string; hue: ProgramHue; duration: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close on navigation
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);
  return (
    <div className="relative" ref={ref} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className={cn("flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[14.5px] font-medium transition-colors", open ? "bg-white/[0.06] text-ink" : "text-ink-soft hover:bg-white/[0.06] hover:text-ink")}
      >
        Programs <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full pt-2">
          <div className="w-[560px] glass rounded-3xl border border-white/10 p-3 shadow-lift">
            <div className="grid grid-cols-2 gap-1">
              {programs.map((p) => (
                <Link key={p.slug} href={`/programs/${p.slug}`} className={cn("group rounded-2xl p-4 transition-colors", tint[p.hue])}>
                  <span className="flex items-center gap-2 font-display text-[16px] font-semibold text-ink"><span className={cn("size-2 rounded-full", dot[p.hue])} />{p.name}</span>
                  <span className="mt-1 block text-[13px] leading-snug text-ink-muted">{p.pitch}</span>
                  <span className="mt-2 block text-[12px] font-medium text-ink-soft">{p.duration}</span>
                </Link>
              ))}
            </div>
            <Link href="/programs" className="mt-1 block rounded-2xl px-4 py-3 text-[13.5px] font-semibold text-marigold-400 hover:bg-white/[0.04]">Compare all programs</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
