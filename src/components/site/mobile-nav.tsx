"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { buttonClass } from "@/components/ui/button";

export function MobileNav({ items, signedIn }: { items: { href: string; label: string }[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close the menu on route change
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-xl text-ink hover:bg-brand-50"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>
      {open ? (
        <div id="mobile-nav" className="absolute inset-x-0 top-full border-b border-line bg-white px-4 pb-5 pt-2 shadow-lift animate-fade-up">
          <nav className="flex flex-col" aria-label="Mobile">
            {items.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-3 text-[15px] font-medium text-ink hover:bg-brand-50">
                {n.label}
              </Link>
            ))}
          </nav>
          {!signedIn ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link href="/login" className={buttonClass("secondary", "md")}>
                Log in
              </Link>
              <Link href="/register" className={buttonClass("primary", "md")}>
                Get started
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
