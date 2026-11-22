"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { ProgramShowcase } from "./showcase";
import type { ProgramHue, Showcase } from "@/lib/programs";
import { cn } from "@/lib/utils";

export type SwitcherProgram = { slug: string; shortName: string; pitch: string; hue: ProgramHue; showcase: Showcase; price: string; duration: string };

const tint: Record<ProgramHue, string> = { stock: "bg-stock-tint", web: "bg-web-tint", digital: "bg-digital-tint", excel: "bg-excel-tint" };
const dot: Record<ProgramHue, string> = { stock: "bg-stock", web: "bg-web", digital: "bg-digital", excel: "bg-excel" };
const text: Record<ProgramHue, string> = { stock: "text-stock", web: "text-web", digital: "text-digital", excel: "text-excel" };

/** The homepage's signature moment: pick a program and see the kind of work you'll do in it. */
export function HeroSwitcher({ programs }: { programs: SwitcherProgram[] }) {
  const [active, setActive] = useState(0);
  const p = programs[active];
  if (!p) return null;
  return (
    <div>
      <div role="tablist" aria-label="Programs" className="flex flex-wrap gap-2">
        {programs.map((prog, i) => (
          <button
            key={prog.slug}
            role="tab"
            id={`tab-${prog.slug}`}
            aria-selected={i === active}
            aria-controls="program-panel"
            onClick={() => setActive(i)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium transition-colors",
              i === active ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-ink/10 hover:text-ink hover:ring-ink/25",
            )}
          >
            <span className={cn("size-2 rounded-full", dot[prog.hue])} />
            {prog.shortName}
          </button>
        ))}
      </div>
      <div id="program-panel" role="tabpanel" aria-labelledby={`tab-${p.slug}`} className={cn("mt-4 rounded-[28px] p-4 transition-colors duration-300 sm:p-5", tint[p.hue])}>
        <div key={p.slug} className="animate-fade-up">
          <ProgramShowcase kind={p.showcase} hue={p.hue} />
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className={cn("text-[13px] font-semibold", text[p.hue])}>{p.duration}, self-paced</p>
              <p className="mt-0.5 max-w-sm font-display text-[19px] font-semibold leading-snug text-ink">{p.pitch}</p>
            </div>
            <Link href={`/programs/${p.slug}`} className="group inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-[14px] font-semibold text-ink ring-1 ring-ink/10 hover:ring-ink/30">
              View program
              <span className="rounded-full bg-canvas px-2 py-0.5 text-[13px] text-ink-soft">{p.price}</span>
              <ArrowUpRight className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
