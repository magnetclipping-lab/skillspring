"use client";
import { useActionState, useState } from "react";
import { CheckCircle2, Clock3, Compass, Download, FileSpreadsheet, FileText, Hammer, History, Link2, UserCheck, AlertTriangle } from "lucide-react";
import { Alert, Badge, Textarea } from "@/components/ui/primitives";
import { FormMessage, SubmitButton, type ActionState } from "@/components/ui/form";
import { FileUpload } from "@/components/ui/file-upload";
import { submitAssignmentAction } from "@/lib/actions/learning";
import { cn, formatDate } from "@/lib/utils";
import type { AssignmentKind, EvalStatus, RubricCriterion } from "@/lib/types";

export type PanelAssignment = {
  id: string; title: string; kind: AssignmentKind; summary: string | null; scenario: string | null; instructions: string;
  deliverables: string | null; submission_requirements: string | null; rubric: RubricCriterion[]; max_score: number; pass_pct: number;
  template_name: string | null; has_template: boolean; accepted_types: string[]; allow_text: boolean; allow_links: boolean;
  allow_file: boolean; is_mandatory: boolean; estimated_minutes: number | null; ai_evaluation: boolean;
};
export type PanelSubmission = {
  id: string; status: string; eval_status: EvalStatus; version: number; text_response: string | null; file_path: string | null; file_name: string | null;
  links: string[]; feedback: string | null; score: number | null; max_score: number | null; score_source: "ai" | "human" | null;
  ai_criteria: { criterion: string; score: number; max: number; comment?: string }[] | null; submitted_at: string | null; evaluate_after: string | null; evaluated_at: string | null;
};
export type PanelHistory = { version: number; submitted_at: string; file_name: string | null; links: string[]; has_text: boolean }[];

const KIND: Record<AssignmentKind, { label: string; icon: typeof FileText }> = {
  file: { label: "Workbook assignment", icon: FileSpreadsheet },
  document: { label: "Written assignment", icon: FileText },
  practical: { label: "Practical project", icon: Hammer },
  scenario: { label: "Scenario challenge", icon: Compass },
};

const ACCEPT_EXT: Record<string, string> = { xlsx: ".xlsx", csv: ".csv", docx: ".docx", pdf: ".pdf", pptx: ".pptx", png: ".png", jpg: ".jpg,.jpeg", zip: ".zip", txt: ".txt" };

export function evalLabel(s: PanelSubmission | null): { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" | "cyan" } {
  if (!s) return { label: "Not submitted", tone: "neutral" };
  switch (s.eval_status) {
    case "pending": return { label: "Pending evaluation", tone: "brand" };
    case "evaluating": return { label: "Evaluating", tone: "brand" };
    case "needs_review": return { label: "With a reviewer", tone: "warning" };
    case "failed": return { label: "With a reviewer", tone: "warning" };
    default: return s.status === "approved" ? { label: "Passed", tone: "success" } : { label: "Needs revision", tone: "danger" };
  }
}

function Timeline({ s }: { s: PanelSubmission }) {
  const evaluated = s.eval_status === "evaluated" || s.eval_status === "reviewed";
  const review = s.eval_status === "needs_review" || s.eval_status === "failed";
  const steps = [
    { icon: CheckCircle2, t: `Submitted · v${s.version}`, d: s.submitted_at ? formatDate(s.submitted_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "", done: true },
    {
      icon: Clock3, t: "Pending evaluation",
      d: evaluated || review ? "Done" : s.evaluate_after ? `Scheduled after ${formatDate(s.evaluate_after, { hour: "numeric", minute: "2-digit" })}` : "Queued",
      done: evaluated || review,
    },
    review
      ? { icon: UserCheck, t: "Human review", d: "A reviewer is confirming your marks", done: false }
      : { icon: CheckCircle2, t: evaluated ? (s.score_source === "human" ? "Reviewed" : "Evaluated") : "Results", d: s.evaluated_at ? formatDate(s.evaluated_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "", done: evaluated },
  ];
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {steps.map((st) => (
        <li key={st.t} className={cn("rounded-lg border px-3.5 py-3", st.done ? "border-cyan-400/30 bg-cyan-400/[0.05]" : "border-line")}>
          <p className="flex items-center gap-2 text-[13px] font-semibold"><st.icon className={cn("size-4", st.done ? "text-cyan-400" : "text-ink-muted")} />{st.t}</p>
          {st.d ? <p className="mt-1 text-[12px] text-ink-muted">{st.d}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function Results({ s, a }: { s: PanelSubmission; a: PanelAssignment }) {
  if (!(s.eval_status === "evaluated" || s.eval_status === "reviewed") || s.score == null) return null;
  const max = s.max_score ?? a.max_score;
  const passed = s.status === "approved";
  return (
    <div className="rounded-lg border border-line">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-5">
        <div>
          <p className="kicker">Result · version {s.version}</p>
          <p className="mt-1 font-display text-4xl font-semibold">{Math.round(Number(s.score))}<span className="text-lg text-ink-muted">/{max}</span></p>
        </div>
        <div className="text-right text-[12.5px] text-ink-muted">
          <Badge tone={passed ? "success" : "danger"}>{passed ? "Passed" : "Below pass mark"}</Badge>
          <p className="mt-1.5">Pass mark {a.pass_pct}% · {s.score_source === "human" ? "Reviewed by the Proofwork team" : "AI-assisted evaluation"}</p>
        </div>
      </div>
      {s.ai_criteria?.length ? (
        <ul className="divide-y divide-line">
          {s.ai_criteria.map((c) => (
            <li key={c.criterion} className="p-5">
              <div className="flex justify-between gap-4 text-sm"><span className="font-medium">{c.criterion}</span><span className="font-mono text-ink-muted">{c.score}/{c.max}</span></div>
              <div className="mt-2 h-1.5 rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-violet-500" style={{ width: `${c.max ? (c.score / c.max) * 100 : 0}%` }} /></div>
              {c.comment ? <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">{c.comment}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {s.feedback ? <div className="border-t border-line p-5"><p className="kicker">Overall feedback</p><p className="mt-2 whitespace-pre-line text-[14px] leading-7 text-ink-soft">{s.feedback}</p></div> : null}
    </div>
  );
}

export function AssignmentPanel({ assignment: a, submission: s, history, courseId, enrolled }: {
  assignment: PanelAssignment; submission: PanelSubmission | null; history: PanelHistory; courseId: string; enrolled: boolean;
}) {
  const [state, action] = useActionState<ActionState, FormData>(submitAssignmentAction, null);
  const [editing, setEditing] = useState(!s);
  const locked = s?.status === "approved";
  const k = KIND[a.kind];
  const status = evalLabel(s);
  const accept = a.accepted_types.map((t) => ACCEPT_EXT[t] ?? `.${t}`).join(",");
  const rubricTotal = a.rubric.reduce((n, r) => n + r.points, 0);

  return (
    <section className="rounded-xl border border-line bg-surface" aria-labelledby={`asg-${a.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-6">
        <div>
          <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-violet-300"><k.icon className="size-4" />{k.label}</p>
          <h2 id={`asg-${a.id}`} className="mt-2 font-display text-xl font-semibold">{a.title}</h2>
          <p className="mt-1 text-[13px] text-ink-muted">
            {a.estimated_minutes ? `About ${Math.round((a.estimated_minutes / 60) * 10) / 10} hours · ` : ""}{a.max_score} marks · pass mark {a.pass_pct}%{a.is_mandatory ? " · required" : ""}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="space-y-6 p-6">
        {a.scenario ? (
          <div className="rounded-lg border-l-2 border-cyan-400 bg-white/[0.02] px-5 py-4">
            <p className="kicker">Scenario</p>
            <p className="mt-2 text-[15px] leading-7 text-ink">{a.scenario}</p>
          </div>
        ) : null}
        <div className="whitespace-pre-line text-[14.5px] leading-7 text-ink-soft">{a.instructions.replace(/\*\*(.+?)\*\*/g, "$1")}</div>
        <dl className="grid gap-4 sm:grid-cols-2">
          {a.deliverables ? <div><dt className="kicker">Deliverable</dt><dd className="mt-1.5 text-[14px] text-ink-soft">{a.deliverables}</dd></div> : null}
          {a.submission_requirements ? <div><dt className="kicker">How to submit</dt><dd className="mt-1.5 text-[14px] text-ink-soft">{a.submission_requirements}</dd></div> : null}
        </dl>

        {a.has_template ? (
          <a href={`/api/templates/${a.id}`} className="flex items-center gap-3 rounded-lg border border-line px-4 py-3 text-sm transition hover:border-violet-400">
            <Download className="size-4 text-violet-300" />
            <span className="flex-1"><span className="font-medium text-ink">Download {a.kind === "file" ? "workbook" : "brief"}</span><span className="ml-2 text-ink-muted">{a.template_name}</span></span>
          </a>
        ) : null}

        {a.rubric.length ? (
          <details className="group rounded-lg border border-line [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">Marking rubric · {rubricTotal} marks<span className="text-ink-muted transition group-open:rotate-180">⌄</span></summary>
            <table className="w-full border-t border-line text-left text-[13.5px]">
              <tbody>
                {a.rubric.map((r) => (
                  <tr key={r.criterion} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 align-top font-medium text-ink">{r.criterion}</td>
                    <td className="px-4 py-3 align-top text-ink-muted">{r.description}</td>
                    <td className="px-4 py-3 text-right align-top font-mono text-ink-soft">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ) : null}

        {s ? <Timeline s={s} /> : null}
        {s ? <Results s={s} a={a} /> : null}
        {s?.eval_status === "needs_review" || s?.eval_status === "failed" ? (
          <Alert tone="info" title="A reviewer is confirming your marks">You&apos;ll get a notification as soon as your result is ready.</Alert>
        ) : null}

        {s && !editing ? (
          <div className="rounded-lg border border-line p-4 text-[13.5px]">
            <p className="kicker">Your current submission · v{s.version}</p>
            <ul className="mt-2 space-y-1.5 text-ink-soft">
              {s.file_name ? <li className="flex items-center gap-2"><FileText className="size-4 text-ink-muted" />{s.file_name}</li> : null}
              {s.links.map((l) => <li key={l} className="flex items-center gap-2 break-all"><Link2 className="size-4 shrink-0 text-ink-muted" /><a href={l} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-ink">{l}</a></li>)}
              {s.text_response ? <li className="line-clamp-3 whitespace-pre-line">{s.text_response}</li> : null}
            </ul>
            {enrolled && !locked ? (
              <button type="button" onClick={() => setEditing(true)} className="mt-3 text-[13px] font-semibold text-violet-300 hover:text-violet-200">
                {s.eval_status === "pending" ? "Change before evaluation" : "Resubmit a new version"}
              </button>
            ) : null}
          </div>
        ) : null}

        {enrolled && !locked && editing ? (
          <form action={action} className="space-y-4 rounded-lg border border-line p-5">
            <FormMessage state={state} />
            <input type="hidden" name="assignment_id" value={a.id} />
            {a.allow_file ? (
              <FileUpload
                kind="assignment" name="file_path" fileNameField="file_name" courseId={courseId} accept={accept}
                label={`Upload your file (${a.accepted_types.join(", ").toUpperCase()}, max 20 MB)`}
                defaultPath={s?.file_path} defaultFileName={s?.file_name}
              />
            ) : null}
            {a.allow_links ? (
              <div>
                <label htmlFor={`links-${a.id}`} className="mb-1.5 block text-[13px] font-medium">Links to your work (one per line, https only, up to 5)</label>
                <Textarea id={`links-${a.id}`} name="links" rows={3} defaultValue={s?.links.join("\n") ?? ""} placeholder="https://…" />
              </div>
            ) : null}
            {a.allow_text ? (
              <div>
                <label htmlFor={`text-${a.id}`} className="mb-1.5 block text-[13px] font-medium">{a.kind === "scenario" ? "Your response" : "Notes or written response"}</label>
                <Textarea id={`text-${a.id}`} name="text_response" rows={a.kind === "scenario" ? 12 : 5} maxLength={20000} defaultValue={s?.text_response ?? ""} />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-3">
              <SubmitButton pendingText="Submitting…">{s ? "Submit new version" : "Submit assignment"}</SubmitButton>
              {s ? <button type="button" onClick={() => setEditing(false)} className="text-[13px] text-ink-muted hover:text-ink">Cancel</button> : null}
              <p className="text-[12.5px] text-ink-muted">{a.ai_evaluation ? "Evaluation starts about an hour after you submit." : "This assignment is marked by a reviewer."}</p>
            </div>
          </form>
        ) : null}
        {locked ? <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="size-4" />You passed this assignment.</p> : null}

        {history.length > 1 ? (
          <details className="rounded-lg border border-line">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium"><History className="size-4 text-ink-muted" />Submission history ({history.length} versions)</summary>
            <ul className="divide-y divide-line border-t border-line text-[13px]">
              {history.map((h) => (
                <li key={h.version} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-ink-soft">
                  <span className="font-mono text-ink-muted">v{h.version}</span>
                  <span>{formatDate(h.submitted_at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                  <span className="text-ink-muted">{[h.file_name, h.links.length ? `${h.links.length} link${h.links.length > 1 ? "s" : ""}` : null, h.has_text ? "text" : null].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {!enrolled ? <p className="flex items-center gap-2 text-[13px] text-ink-muted"><AlertTriangle className="size-4" />Preview only — enrol to submit.</p> : null}
      </div>
    </section>
  );
}
