"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { accentDot } from "@/components/courses/accent";

export type MenuCategory = { slug: string; name: string; tagline: string | null; accent: string | null; courses: { slug: string; title: string }[] };

export function CoursesMenu({ categories }: { categories: MenuCategory[] }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
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
  const cat = categories[active];
  return (
    <div className="relative" ref={ref} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        className={cn("flex items-center gap-1.5 rounded-md px-3 py-2 text-[14.5px] font-medium transition-colors", open ? "text-ink" : "text-ink-soft hover:text-ink")}
      >
        Courses <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && cat ? (
        <div className="absolute left-0 top-full pt-2">
          <div className="grid w-[760px] grid-cols-[240px_1fr] overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
            <ul className="border-r border-line p-2">
              {categories.map((c, i) => (
                <li key={c.slug}>
                  <Link
                    href={`/courses?category=${c.slug}`}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    className={cn("flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[14px] font-medium", i === active ? "bg-raised text-ink" : "text-ink-soft hover:text-ink")}
                  >
                    <span className={cn("size-1.5 rounded-full", accentDot(c.accent))} />
                    {c.name}
                  </Link>
                </li>
              ))}
              <li className="mt-1 border-t border-line pt-1">
                <Link href="/courses" className="block rounded-md px-3 py-2.5 text-[13.5px] font-semibold text-violet-300 hover:text-violet-200">All 24 courses →</Link>
              </li>
            </ul>
            <div className="p-5">
              <p className="kicker">{cat.name}</p>
              {cat.tagline ? <p className="mt-1.5 text-[13.5px] text-ink-muted">{cat.tagline}</p> : null}
              <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1">
                {cat.courses.map((c) => (
                  <li key={c.slug}>
                    <Link href={`/courses/${c.slug}`} className="block rounded-md py-1.5 text-[14px] text-ink-soft transition hover:text-ink">{c.title}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
