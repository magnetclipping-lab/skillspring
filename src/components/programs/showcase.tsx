import type { ProgramHue, Showcase } from "@/lib/programs";
import { cn } from "@/lib/utils";

/**
 * Illustrative, clearly-labelled sample visuals for each program.
 * They depict the kind of work students do — not real market or campaign data.
 */
const HEX: Record<ProgramHue, string> = { stock: "#2fd394", web: "#8b8dff", digital: "#ff6f98", excel: "#45b3f5" };

function Frame({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[22px] bg-surface ring-1 ring-ink/10", className)}>
      <div className="flex items-center gap-2 border-b border-ink/8 px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-[#ff6159]" />
        <span className="size-2.5 rounded-full bg-[#ffbd2e]" />
        <span className="size-2.5 rounded-full bg-[#28c941]" />
        <span className="ml-2 truncate text-[12.5px] font-medium text-ink-muted">{title}</span>
        <span className="ml-auto rounded-md bg-canvas px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted">Sample</span>
      </div>
      {children}
    </div>
  );
}

function Chart({ hue }: { hue: ProgramHue }) {
  // Deterministic candles (illustrative only).
  const closes = [42, 45, 44, 48, 47, 51, 50, 49, 53, 56, 55, 58, 57, 61, 60, 64, 63, 66, 69, 68, 72, 71, 75, 78];
  const w = 520, h = 230, pad = 16, step = (w - pad * 2) / closes.length;
  const y = (v: number) => h - 20 - ((v - 38) / 44) * (h - 50);
  const ma = closes.map((_, i) => closes.slice(Math.max(0, i - 4), i + 1).reduce((a, b) => a + b, 0) / Math.min(i + 1, 5));
  return (
    <Frame title="Practice chart, daily candles">
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-[15px] font-semibold text-ink">Trend, support &amp; moving average</p>
          <p className="text-[12px] font-medium" style={{ color: HEX[hue] }}>Uptrend</p>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full" role="img" aria-label="Illustrative candlestick chart showing an uptrend">
          {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={h * f} y2={h * f} stroke="#ffffff" strokeOpacity="0.06" />)}
          <line x1={pad} x2={w - pad} y1={y(47.5)} y2={y(47.5)} stroke={HEX[hue]} strokeDasharray="5 5" strokeOpacity="0.6" />
          {closes.map((c, i) => {
            const o = i === 0 ? c - 2 : closes[i - 1];
            const up = c >= o;
            const x = pad + i * step + step / 2;
            const hi = Math.max(o, c) + 1.6, lo = Math.min(o, c) - 1.6;
            return (
              <g key={i}>
                <line x1={x} x2={x} y1={y(hi)} y2={y(lo)} stroke={up ? HEX[hue] : "#ff6f98"} strokeWidth="1.5" />
                <rect x={x - step * 0.3} width={step * 0.6} y={y(Math.max(o, c))} height={Math.max(2, Math.abs(y(o) - y(c)))} rx="1.5" fill={up ? HEX[hue] : "#ff6f98"} />
              </g>
            );
          })}
          <polyline fill="none" stroke="#f0b544" strokeWidth="2.5" points={ma.map((m, i) => `${pad + i * step + step / 2},${y(m)}`).join(" ")} />
        </svg>
        <div className="mt-1 flex gap-4 text-[11.5px] text-ink-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-marigold-400" />5-day average</span>
          <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed" style={{ borderColor: HEX[hue] }} />Support</span>
        </div>
      </div>
    </Frame>
  );
}

function Code({ hue }: { hue: ProgramHue }) {
  return (
    <div className="grid gap-3 sm:grid-cols-[1.15fr_1fr]">
      <div className="overflow-hidden rounded-[22px] bg-[#0b0d14] ring-1 ring-ink/10">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-[12.5px] text-white/60">
          <span className="rounded-md bg-white/10 px-2 py-0.5 text-white/80">Hero.jsx</span>
          <span className="ml-auto rounded-md bg-white/10 px-1.5 py-0.5 text-[10.5px]">Sample</span>
        </div>
        <pre className="overflow-hidden px-4 py-3.5 font-mono text-[12.5px] leading-6 text-white/80">
{`export function Hero() {
  return (
    `}<span style={{ color: "#a5b4fc" }}>{`<section className="hero">`}</span>{`
      `}<span style={{ color: "#a5b4fc" }}>{`<h1>`}</span><span className="text-white">Hi, I build</span>{`
        `}<span className="text-white">for the web.</span><span style={{ color: "#a5b4fc" }}>{`</h1>`}</span>{`
      `}<span style={{ color: "#a5b4fc" }}>{`<a href="#work">`}</span><span className="text-white">See my work</span><span style={{ color: "#a5b4fc" }}>{`</a>`}</span>{`
    `}<span style={{ color: "#a5b4fc" }}>{`</section>`}</span>{`
  );
}`}
        </pre>
      </div>
      <Frame title="localhost:3000">
        <div className="p-5">
          <div className="h-2 w-12 rounded-full" style={{ background: HEX[hue] }} />
          <p className="mt-4 font-display text-[22px] font-bold leading-tight text-ink">Hi, I build for the web.</p>
          <div className="mt-4 inline-flex rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white" style={{ background: HEX[hue] }}>See my work</div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-14 rounded-lg bg-canvas" />
            <div className="h-14 rounded-lg bg-canvas" />
          </div>
        </div>
      </Frame>
    </div>
  );
}

function Campaign({ hue }: { hue: ProgramHue }) {
  const bars = [
    { label: "Reels", v: 0.86 },
    { label: "Search ads", v: 0.64 },
    { label: "Email", v: 0.48 },
    { label: "Stories", v: 0.36 },
  ];
  return (
    <Frame title="Campaign plan for launch week">
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          {[["Goal", "Sign-ups"], ["Audience", "College students, 18–24"], ["Budget split", "60% social, 40% search"]].map(([k, val]) => (
            <div key={k} className="rounded-xl bg-canvas px-3 py-2.5">
              <p className="text-[11px] text-ink-muted">{k}</p>
              <p className="text-[13.5px] font-semibold text-ink">{val}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[12px] font-medium text-ink-muted">Planned reach by channel</p>
          <div className="mt-3 space-y-3">
            {bars.map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-[12px] text-ink-soft"><span>{b.label}</span></div>
                <div className="mt-1 h-2.5 rounded-full bg-canvas"><div className="h-full rounded-full" style={{ width: `${b.v * 100}%`, background: HEX[hue] }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Sheet({ hue }: { hue: ProgramHue }) {
  const rows = [
    ["INV-1041", "C-102", "48,500", "30"],
    ["INV-1042", "C-117", "1,20,000", "60"],
    ["INV-1043", "C-109", "36,750", "45"],
    ["INV-1044", "C-130", "92,400", "Not found"],
  ];
  return (
    <Frame title="Invoices.xlsx">
      <div className="flex items-center gap-2 border-b border-ink/8 px-4 py-2 font-mono text-[12px]">
        <span className="rounded bg-canvas px-1.5 py-0.5 text-ink-muted">D2</span>
        <span className="text-ink-soft">=XLOOKUP(B2, Terms!A:A, Terms!D:D, &quot;Not found&quot;)</span>
      </div>
      <table className="w-full text-left text-[12.5px] tabular-nums">
        <thead><tr className="bg-canvas text-[11px] text-ink-muted"><th className="px-4 py-2 font-medium">Invoice</th><th className="px-2 py-2 font-medium">Customer</th><th className="px-2 py-2 text-right font-medium">Amount ₹</th><th className="px-4 py-2 text-right font-medium">Credit days</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r[0]} className="border-t border-ink/6">
              <td className="px-4 py-2 text-ink">{r[0]}</td><td className="px-2 py-2 text-ink-soft">{r[1]}</td><td className="px-2 py-2 text-right text-ink-soft">{r[2]}</td>
              <td className={cn("px-4 py-2 text-right font-semibold", i === 0 && "ring-2 ring-inset")} style={{ color: r[3] === "Not found" ? "#c98a0b" : HEX[hue], ...(i === 0 ? { ["--tw-ring-color" as string]: HEX[hue] } : {}) }}>{r[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Frame>
  );
}

export function ProgramShowcase({ kind, hue, className }: { kind: Showcase; hue: ProgramHue; className?: string }) {
  return (
    <div className={className}>
      {kind === "chart" ? <Chart hue={hue} /> : kind === "code" ? <Code hue={hue} /> : kind === "campaign" ? <Campaign hue={hue} /> : <Sheet hue={hue} />}
    </div>
  );
}
