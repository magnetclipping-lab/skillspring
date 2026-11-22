/** Branded transactional email templates (pure functions, unit tested). */

export type TemplateName =
  | "welcome"
  | "payment_success"
  | "course_completed"
  | "certificate_issued"
  | "application_received"
  | "application_status"
  | "instructor_application";

type Data = Record<string, string | undefined>;

const esc = (s: string | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(title: string, bodyHtml: string, cta?: { label: string; url?: string }) {
  const button = cta?.url
    ? `<p style="margin:28px 0 8px"><a href="${esc(cta.url)}" style="background:#3b45b8;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f3f4fe;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f1430">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e5e7ef">
<tr><td style="background:#141a4d;padding:22px 28px;color:#fff;font-size:18px;font-weight:700">SkillSpring</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:22px;line-height:1.3">${esc(title)}</h1>
<div style="font-size:15px;line-height:1.65;color:#4a5072">${bodyHtml}</div>${button}
</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #e5e7ef;font-size:12px;color:#7a8099">You are receiving this email because of activity on your SkillSpring account.</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderTemplate(name: TemplateName, d: Data): { subject: string; html: string } {
  switch (name) {
    case "welcome":
      return {
        subject: "Welcome to SkillSpring",
        html: layout(`Welcome, ${d.name || "there"}!`, `<p>Your SkillSpring account is ready. Explore practical courses and project-based experiences built for students.</p>`, { label: "Explore courses", url: d.url }),
      };
    case "payment_success":
      return {
        subject: `Payment confirmed: ${d.courseTitle}`,
        html: layout("Payment confirmed", `<p>Hi ${esc(d.name)},</p><p>We have verified your payment of <strong>${esc(d.amount)}</strong> for <strong>${esc(d.courseTitle)}</strong>. You now have access to the course.</p>`, { label: "Start learning", url: d.url }),
      };
    case "course_completed":
      return {
        subject: `You completed ${d.courseTitle}`,
        html: layout("Course completed", `<p>Hi ${esc(d.name)},</p><p>You have met all completion requirements for <strong>${esc(d.courseTitle)}</strong>.</p>`, { label: "View certificate", url: d.url }),
      };
    case "certificate_issued":
      return {
        subject: `Your certificate for ${d.courseTitle}`,
        html: layout("Your certificate is ready", `<p>Hi ${esc(d.name)},</p><p>Your certificate for <strong>${esc(d.courseTitle)}</strong> has been issued.</p><p>Certificate ID: <strong>${esc(d.code)}</strong></p><p>Anyone can verify it at <a href="${esc(d.verifyUrl)}">${esc(d.verifyUrl)}</a>.</p>`, { label: "Open certificate", url: d.url }),
      };
    case "application_received":
      return {
        subject: `Application received: ${d.title}`,
        html: layout("Application received", `<p>Hi ${esc(d.name)},</p><p>We have received your application for <strong>${esc(d.title)}</strong>. You can track its status from your dashboard.</p>`, { label: "Track application", url: d.url }),
      };
    case "application_status":
      return {
        subject: `Application update: ${d.title}`,
        html: layout("Application update", `<p>Hi ${esc(d.name)},</p><p>The status of your application for <strong>${esc(d.title)}</strong> is now <strong>${esc(d.status)}</strong>.</p>${d.note ? `<p>Note: ${esc(d.note)}</p>` : ""}`, { label: "View application", url: d.url }),
      };
    case "instructor_application":
      return {
        subject: "We received your instructor application",
        html: layout("Thanks for applying to teach", `<p>Hi ${esc(d.name)},</p><p>Our team will review your instructor profile. We'll email you once a decision is made.</p>`),
      };
  }
}
