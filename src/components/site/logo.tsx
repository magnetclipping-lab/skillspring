import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Proofwork mark: a step-up line that ends in a node — a level reached, progress you can show.
 * Variants:
 *  - <LogoMark />            tile (navbar, favicon, app icon)
 *  - <LogoGlyph />           glyph only, inherits currentColor-friendly accents (footer, dashboard, inline)
 *  - <Logo />                navbar lockup (tile + wordmark)
 *  - <Logo variant="plain"/> glyph + wordmark without tile (footer, dashboard sidebar)
 */
const PATH = "M7.5 21.5H12.5L18.5 10.5H24.5";

export function LogoGlyph({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden fill="none">
      <path d={PATH} stroke={mono ? "currentColor" : "#8D76FF"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="10.5" r="3.25" fill={mono ? "currentColor" : "#55D6E8"} />
    </svg>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden fill="none">
      <rect width="32" height="32" rx="8" fill="#101827" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="#ffffff" strokeOpacity="0.1" />
      <path d={PATH} stroke="#8D76FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24.5" cy="10.5" r="3.25" fill="#55D6E8" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-display text-[19px] font-semibold tracking-[-0.03em] text-ink", className)}>Proofwork</span>;
}

export function Logo({ className, variant = "tile", href = "/" }: { className?: string; variant?: "tile" | "plain"; href?: string; tone?: "dark" | "light" }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5", className)} aria-label="Proofwork home">
      {variant === "tile" ? <LogoMark className="size-7" /> : <LogoGlyph className="size-6" />}
      <Wordmark />
    </Link>
  );
}
