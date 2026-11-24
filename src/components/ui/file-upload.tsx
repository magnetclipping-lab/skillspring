"use client";
import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, X } from "lucide-react";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/utils";

type Kind = "avatar" | "thumbnail" | "resume" | "assignment" | "resource" | "preview" | "poster";

/** Files above this go straight to Storage via a signed URL (serverless body limit is ~4.5 MB). */
const DIRECT_LIMIT = 4 * 1024 * 1024;

type Uploaded = { path: string; url?: string; fileName: string; size: number; mime: string };

function xhrSend(method: string, url: string, body: XMLHttpRequestBodyInit, onProgress: (p: number) => void, headers: Record<string, string> = {}) {
  return new Promise<{ status: number; text: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(body);
  });
}

const parse = (t: string) => { try { return JSON.parse(t) as Record<string, string>; } catch { return {} as Record<string, string>; } };

/**
 * Uploads a file with real progress, then stores the storage path in a hidden input named `name`
 * (and the original file name in `fileNameField`, if given). Small files go through /api/uploads,
 * where the type is checked before storing; large files are uploaded directly with a signed URL and
 * then verified by /api/uploads/finalize, which deletes anything that isn't the type it claims to be.
 */
export function FileUpload({ kind, name, accept, courseId, label, help, onUploaded, defaultPath, defaultFileName, fileNameField }: {
  kind: Kind; name: string; accept: string; courseId?: string; label: string; help?: string;
  onUploaded?: (r: Uploaded) => void; defaultPath?: string | null; defaultFileName?: string | null; fileNameField?: string;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [path, setPath] = useState<string>(defaultPath ?? "");
  const [fileName, setFileName] = useState<string | null>(defaultFileName ?? (defaultPath ? defaultPath.split("/").pop() ?? null : null));
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    setProgress(0);
    try {
      let result: Record<string, string>;
      if (file.size <= DIRECT_LIMIT) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind);
        if (courseId) fd.append("courseId", courseId);
        const r = await xhrSend("POST", "/api/uploads", fd, setProgress);
        result = parse(r.text);
        if (r.status < 200 || r.status >= 300 || !result.path) throw new Error(result.error ?? "Upload failed. Please try again.");
      } else {
        const meta = { kind, courseId, fileName: file.name, size: file.size };
        const s = await fetch("/api/uploads/sign", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(meta) });
        const sj = parse(await s.text());
        if (!s.ok || !sj.signedUrl) throw new Error(sj.error ?? "Could not start the upload.");
        const put = await xhrSend("PUT", sj.signedUrl, file, setProgress, { "content-type": file.type || "application/octet-stream", "x-upsert": "false", "cache-control": "max-age=3600", apikey: publicEnv.supabaseAnonKey });
        if (put.status < 200 || put.status >= 300) throw new Error("Upload failed. Please try again.");
        const fin = await fetch("/api/uploads/finalize", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...meta, path: sj.path }) });
        result = parse(await fin.text());
        if (!fin.ok || !result.path) throw new Error(result.error ?? "Upload could not be verified.");
      }
      setPath(result.path);
      setFileName(file.name);
      onUploaded?.({ path: result.path, url: result.url, fileName: file.name, size: file.size, mime: result.mime ?? file.type });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">{label}</p>
      <input type="hidden" name={name} value={path} />
      {fileNameField ? <input type="hidden" name={fileNameField} value={path ? fileName ?? "" : ""} /> : null}
      <div className={cn("flex items-center gap-3 rounded-lg border border-dashed px-4 py-3", error ? "border-red-400/40 bg-red-500/[0.06]" : "border-line bg-white/[0.02]")}>
        {progress !== null ? <Loader2 className="size-5 animate-spin text-violet-300" /> : path ? <CheckCircle2 className="size-5 text-emerald-400" /> : <FileUp className="size-5 text-ink-muted" />}
        <div className="min-w-0 flex-1 text-sm">
          {progress !== null ? (
            <div>
              <p className="text-ink-soft">Uploading… {progress}%</p>
              <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500 transition-[width]" style={{ width: `${progress}%` }} /></div>
            </div>
          ) : path ? (
            <p className="truncate font-medium text-ink">{fileName}</p>
          ) : (
            <p className="text-ink-muted">{help ?? "Choose a file to upload"}</p>
          )}
        </div>
        {path && progress === null ? (
          <button type="button" className="rounded-md p-1 text-ink-muted hover:bg-white/[0.06]" onClick={() => { setPath(""); setFileName(null); if (inputRef.current) inputRef.current.value = ""; onUploaded?.({ path: "", fileName: "", size: 0, mime: "" }); }} aria-label="Remove file"><X className="size-4" /></button>
        ) : null}
        <label className="cursor-pointer rounded-md bg-surface px-3 py-1.5 text-[13px] font-semibold text-violet-300 ring-1 ring-line hover:ring-violet-400">
          {path ? "Replace" : "Browse"}
          <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} disabled={progress !== null} />
        </label>
      </div>
      {error ? <p className="mt-1.5 text-[12.5px] text-red-400" role="alert">{error}</p> : null}
    </div>
  );
}
