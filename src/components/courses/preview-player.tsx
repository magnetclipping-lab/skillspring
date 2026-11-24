"use client";
import { useEffect, useRef, useState } from "react";
import { Play, X, Film } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 30-second course preview. Plays the uploaded preview video (1080p MP4/WebM from the
 * course-previews bucket). If no preview has been uploaded yet, says so plainly —
 * it never shows a stand-in video.
 */
export function PreviewButton({ title, src, poster, className, variant = "chip" }: { title: string; src?: string | null; poster?: string | null; className?: string; variant?: "chip" | "overlay" }) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Watch the 30-second preview of ${title}`}
        className={cn(
          variant === "overlay"
            ? "absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition hover:bg-black/40 hover:opacity-100 focus-visible:bg-black/40 focus-visible:opacity-100"
            : "inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[12.5px] font-medium text-ink-soft transition hover:border-white/25 hover:text-ink",
          className,
        )}
      >
        {variant === "overlay" ? (
          <span className="grid size-12 place-items-center rounded-full bg-white/90 text-canvas"><Play className="ml-0.5 size-5 fill-current" /></span>
        ) : (
          <><Play className="size-3.5" />30s preview</>
        )}
      </button>
      <dialog
        ref={dialog}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialog.current && setOpen(false)}
        className="m-auto w-[min(960px,92vw)] rounded-xl border border-line bg-surface p-0 text-ink backdrop:bg-black/70"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="truncate text-sm font-semibold">{title} · preview</p>
          <button type="button" onClick={() => setOpen(false)} className="grid size-8 place-items-center rounded-md text-ink-soft hover:bg-white/[0.06] hover:text-ink" aria-label="Close preview">
            <X className="size-4" />
          </button>
        </div>
        {open && src ? (
          <video className="aspect-video w-full bg-black" src={src} poster={poster ?? undefined} controls autoPlay playsInline preload="metadata">
            <track kind="captions" />
          </video>
        ) : (
          <div className="grid aspect-video w-full place-items-center bg-canvas p-8 text-center">
            <div className="max-w-sm">
              <Film className="mx-auto size-8 text-ink-muted" />
              <p className="mt-3 font-display text-lg font-semibold">Preview video coming soon</p>
              <p className="mt-2 text-sm text-ink-muted">The 30-second preview for this course hasn&apos;t been published yet. The full curriculum, assignments and outcomes are listed on the course page.</p>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
