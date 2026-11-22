import { ImageResponse } from "next/og";

export const alt = "SkillSpring — Learn Skills. Build Experience. Shape Your Future.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #0b1033 0%, #1e2670 60%, #4c1d95 100%)", color: "white" }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: "#a3acf1" }}>SkillSpring</div>
        <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginTop: 24, maxWidth: 900 }}>Learn Skills. Build Experience. Shape Your Future.</div>
        <div style={{ fontSize: 30, marginTop: 28, color: "#e6e8fc" }}>Affordable, practical, career-focused learning for students across India.</div>
      </div>
    ),
    size,
  );
}
