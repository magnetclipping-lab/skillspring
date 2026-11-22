import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="ss-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4f5bd5" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#ss-g)" />
      <path d="M10.5 20.5c2.6 2.6 7.8 2.4 9.6-.6 2.2-3.7-3.6-5-6.4-7-2.2-1.6-.6-5 3-4.4 1.4.2 2.4.9 3.1 1.7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="22.5" cy="8.5" r="1.8" fill="#fbbf24" />
    </svg>
  );
}

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label="SkillSpring home">
      <LogoMark />
      <span className={cn("font-display text-[19px] font-bold tracking-tight", tone === "light" ? "text-white" : "text-ink")}>
        Skill<span className={tone === "light" ? "text-brand-300" : "text-brand-600"}>Spring</span>
      </span>
    </Link>
  );
}
