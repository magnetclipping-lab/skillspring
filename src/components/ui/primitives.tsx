import type { ComponentProps, ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div>
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {description ? <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

const badgeTones = {
  neutral: "bg-white/[0.06] text-ink-soft ring-white/10",
  brand: "bg-brand-500/10 text-brand-300 ring-brand-400/30",
  success: "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25",
  warning: "bg-amber-500/10 text-amber-300 ring-amber-400/25",
  danger: "bg-red-500/10 text-red-300 ring-red-400/25",
  violet: "bg-violet-500/10 text-violet-300 ring-violet-400/25",
  cyan: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/25",
  dark: "bg-white/10 text-white ring-white/20",
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11.5px] font-semibold ring-1 ring-inset", badgeTones[tone], className)}>{children}</span>;
}

const alertTones = {
  info: { cls: "border-brand-400/30 bg-brand-500/10 text-brand-300", Icon: Info },
  success: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", Icon: CheckCircle2 },
  warning: { cls: "border-amber-400/25 bg-amber-500/10 text-amber-300", Icon: TriangleAlert },
  danger: { cls: "border-red-500/30 bg-red-500/10 text-red-300", Icon: AlertCircle },
} as const;

export function Alert({ tone = "info", title, children, className }: { tone?: keyof typeof alertTones; title?: ReactNode; children?: ReactNode; className?: string }) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "opacity-90")}>{children}</div> : null}
      </div>
    </div>
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("mb-1.5 block text-[13px] font-medium text-ink", className)} {...props} />;
}

const fieldBase =
  "block w-full rounded-lg border border-white/10 px-3.5 text-sm text-ink placeholder:text-ink-muted/70 bg-white/[0.02] transition focus:border-violet-400/70 focus:ring-4 focus:ring-violet-500/10 focus:outline-none disabled:bg-white/[0.03] aria-[invalid=true]:border-red-400";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldBase, "h-10", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldBase, "min-h-24 py-2.5 leading-6", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldBase, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%237a8099%22 stroke-width=%222%22><path d=%22m4 6 4 4 4-4%22/></svg>')] bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9", className)} {...props} />;
}

/** Label + control + error/help text, with aria wiring. */
export function Field({ label, name, error, help, children, className, required }: { label: ReactNode; name: string; error?: string[] | string; help?: ReactNode; children: ReactNode; className?: string; required?: boolean }) {
  const msg = Array.isArray(error) ? error[0] : error;
  return (
    <div className={className}>
      <Label htmlFor={name}>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </Label>
      {children}
      {msg ? (
        <p id={`${name}-error`} className="mt-1.5 text-[12.5px] text-red-400">
          {msg}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-[12.5px] text-ink-muted">{help}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-2.5 text-sm text-ink-soft", className)}>
      <input type="checkbox" className="mt-0.5 size-4 rounded border-line accent-violet-500" {...props} />
      <span>{label}</span>
    </label>
  );
}

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-white/[0.07]", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
      <div className="h-full rounded-full bg-cyan-400 transition-[width] duration-500" style={{ width: `${v}%` }} />
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center", className)}>
      {icon ? <div className="mb-3 grid size-12 place-items-center rounded-lg bg-brand-500/10 text-brand-300">{icon}</div> : null}
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="eyebrow mb-1">{eyebrow}</p> : null}
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-muted">{label}</p>
        {icon ? <span className="grid size-8 place-items-center rounded-lg bg-brand-500/10 text-brand-300">{icon}</span> : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[12.5px] text-ink-muted">{hint}</p> : null}
    </Card>
  );
}

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-line bg-surface", className)}>
      <table className="w-full min-w-[640px] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[12px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-ink-muted [&_thead]:bg-white/[0.02] [&_tbody_tr]:border-t [&_tbody_tr]:border-line [&_tbody_tr:hover]:bg-white/[0.02]">
        {children}
      </table>
    </div>
  );
}
