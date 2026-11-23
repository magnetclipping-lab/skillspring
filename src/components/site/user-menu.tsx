"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown, GraduationCap, LayoutDashboard, LogOut, Settings, Shield } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";

export function UserMenu({ name, email, isAdmin, isInstructor }: { name: string; email: string; isAdmin: boolean; isInstructor: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);
  const initials = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "U";
  const item = "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-brand-500/10 hover:text-ink";

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu" className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 hover:bg-brand-500/10">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">{initials}</span>
        <ChevronDown className="size-4 text-ink-muted" aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-lift animate-fade-up">
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            <p className="truncate text-xs text-ink-muted">{email}</p>
          </div>
          <div className="py-1.5">
            <Link role="menuitem" href="/dashboard" className={item}><LayoutDashboard className="size-4" /> Dashboard</Link>
            <Link role="menuitem" href="/dashboard/learning" className={item}><BookOpen className="size-4" /> My learning</Link>
            {isInstructor ? <Link role="menuitem" href="/instructor" className={item}><GraduationCap className="size-4" /> Instructor portal</Link> : null}
            {isAdmin ? <Link role="menuitem" href="/admin" className={item}><Shield className="size-4" /> Admin</Link> : null}
            <Link role="menuitem" href="/dashboard/settings" className={item}><Settings className="size-4" /> Settings</Link>
          </div>
          <form action={signOutAction} className="border-t border-line pt-1.5">
            <button role="menuitem" type="submit" className={`${item} w-full`}><LogOut className="size-4" /> Log out</button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
