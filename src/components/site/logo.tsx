import Link from "next/link";
import { cn } from "@/lib/utils";

/** Proofwork mark: three rising rungs in gold on a graphite tile — progress you can prove. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id="pw-tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d212c" />
          <stop offset="1" stopColor="#0c0e13" />
        </linearGradient>
        <linearGradient id="pw-gold" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#d8913a" />
          <stop offset="0.5" stopColor="#f0b544" />
          <stop offset="1" stopColor="#ffe2a3" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#pw-tile)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#ffffff" strokeOpacity="0.1" />
      <rect x="8" y="18" width="4" height="6" rx="1.4" fill="url(#pw-gold)" opacity="0.55" />
      <rect x="14" y="13" width="4" height="11" rx="1.4" fill="url(#pw-gold)" opacity="0.8" />
      <rect x="20" y="8" width="4" height="16" rx="1.4" fill="url(#pw-gold)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)} aria-label="Proofwork home">
      <LogoMark />
      <span className="font-display text-[20px] font-semibold tracking-[-0.03em] text-ink">
        Proofwork<span className="text-marigold-400">.</span>
      </span>
    </Link>
  );
}
