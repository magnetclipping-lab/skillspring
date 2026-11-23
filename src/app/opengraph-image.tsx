import { ImageResponse } from "next/og";

export const alt = "Proofwork — Learn Skills. Build Experience. Shape Your Future.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "radial-gradient(900px 500px at 80% -10%, rgba(108,118,245,0.35), transparent 60%), radial-gradient(700px 400px at 0% 100%, rgba(240,181,68,0.18), transparent 60%), #07080b", color: "white" }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: "#f0b544" }}>Proofwork</div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginTop: 24, maxWidth: 900 }}>Learn Skills. Build Experience. Shape Your Future.</div>
        <div style={{ fontSize: 30, marginTop: 28, color: "#b4b9c7" }}>Affordable, practical, career-focused learning for students across India.</div>
      </div>
    ),
    size,
  );
}
