import { ImageResponse } from "next/og";

export const alt = "Proofwork — Build skills that move you forward.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 80, background: "radial-gradient(900px 500px at 85% -10%, rgba(116,87,255,0.30), transparent 60%), #080b12", color: "#f4f5f8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#101827" />
            <path d="M7.5 21.5H12.5L18.5 10.5H24.5" stroke="#8D76FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="24.5" cy="10.5" r="3.25" fill="#55D6E8" />
          </svg>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>Proofwork</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3, maxWidth: 980 }}>Build skills that move you forward.</div>
          <div style={{ fontSize: 30, marginTop: 28, color: "#b4b9c7" }}>AI · Digital marketing · Excel & BI · Business — with rubric-graded assignments.</div>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 24, color: "#55d6e8" }}>
          <span>24 courses</span><span>₹7,500 per course</span><span>Real assignments</span>
        </div>
      </div>
    ),
    size,
  );
}
