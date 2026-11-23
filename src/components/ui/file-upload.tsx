"use client";
import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "avatar" | "thumbnail" | "resume" | "assignment" | "resource";

/**
 * Uploads to /api/uploads with real progress events (XHR), then stores the
 * returned storage path in a hidden input named `name`.
 */
export function FileUpload({ kind, name, accept, courseId, label, help, onUploaded, defaultPath }: {
  kind: Kind; name: string; accept: string; courseId?: string; label: string; help?: string;
  onUploaded?: (r: { path: string; url?: string; fileName: string; size: number; mime: string }) => void; defaultPath?: string | null;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string>(defaultPath ?? "");
  const [fileName, setFileName] = useState<string | null>(defaultPath ? defaultPath.split("/").pop() ?? null : null);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);
    setProgress(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    if (courseId) fd.append("courseId", courseId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setProgress(null);
      let json: { path?: string; url?: string; error?: string; mime?: string } = {};
      try { json = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300 && json.path) {
        setPath(json.path);
        setFileName(file.name);
        onUploaded?.({ path: json.path, url: json.url, fileName: file.name, size: file.size, mime: json.mime ?? file.type });
      } else {
        setError(json.error ?? "Upload failed. Please try again.");
      }
    };
    xhr.onerror = () => { setProgress(null); setError("Network error during upload."); };
    xhr.send(fd);
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">{label}</p>
      <input type="hidden" name={name} value={path} />
      <div className={cn("flex items-center gap-3 rounded-xl border border-dashed px-4 py-3", error ? "border-red-400/25 bg-red-500/10/40" : "border-line bg-white/[0.03]/50")}>
        {progress !== null ? <Loader2 className="size-5 animate-spin text-brand-300" /> : path ? <CheckCircle2 className="size-5 text-emerald-400" /> : <FileUp className="size-5 text-ink-muted" />}
        <div className="min-w-0 flex-1 text-sm">
          {progress !== null ? (
            <div>
              <p className="text-ink-soft">Uploading… {progress}%</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-brand-500/15"><div className="h-full rounded-full bg-brand-500 transition-[width]" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : path ? (
            <p className="truncate font-medium text-ink">{fileName}</p>
          ) : (
            <p className="text-ink-muted">{help ?? "Choose a file to upload"}</p>
          )}
        </div>
        {path && progress === null ? (
          <button type="button" className="rounded-lg p-1 text-ink-muted hover:bg-white/[0.06]" onClick={() => { setPath(""); setFileName(null); if (inputRef.current) inputRef.current.value = ""; }} aria-label="Remove file"><X className="size-4" /></button>
        ) : null}
        <label className="cursor-pointer rounded-lg bg-surface px-3 py-1.5 text-[13px] font-semibold text-brand-300 ring-1 ring-line hover:ring-brand-300">
          {path ? "Replace" : "Browse"}
          <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={progress !== null} />
        </label>
      </div>
      {error ? <p className="mt-1.5 text-[12.5px] text-red-400" role="alert">{error}</p> : null}
    </div>
  );
}
