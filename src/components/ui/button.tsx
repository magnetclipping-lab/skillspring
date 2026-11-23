import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-ink text-canvas hover:bg-white active:bg-ink-soft disabled:bg-ink-muted disabled:text-canvas/70",
  secondary: "bg-white/[0.03] text-ink ring-1 ring-inset ring-white/10 hover:bg-white/[0.06] hover:ring-white/20 disabled:text-ink-muted",
  ghost: "text-ink-soft hover:bg-white/[0.06] hover:text-ink",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300",
  light: "bg-ink text-canvas hover:bg-white",
  outlineLight: "text-white ring-1 ring-inset ring-white/30 hover:bg-white/10",
} as const;

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-xl",
  icon: "h-9 w-9 rounded-lg",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex shrink-0 items-center justify-center font-semibold transition-colors duration-150 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marigold-400",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
