import Link from "next/link";
import { publicEnv } from "@/lib/env";
import { Logo } from "./logo";

const cols = [
  { title: "Learn", links: [["Courses", "/courses"], ["Internships & projects", "/internships"], ["Verify a certificate", "/verify"], ["FAQs", "/faq"]] },
  { title: "Work with us", links: [["Become an instructor", "/become-instructor"], ["Become a partner", "/partners"], ["Contact us", "/contact"]] },
  { title: "Company", links: [["About", "/about"], ["Privacy policy", "/privacy"], ["Terms & conditions", "/terms"], ["Refund policy", "/refund-policy"], ["Disclaimer", "/disclaimer"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-ink-muted">Affordable, practical and career-focused learning for students across India.</p>
          <p className="mt-4 text-sm text-ink-muted">
            <a className="font-medium text-brand-600 hover:underline" href={`mailto:${publicEnv.supportEmail}`}>{publicEnv.supportEmail}</a>
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold text-ink">{c.title}</p>
            <ul className="mt-3 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={href}><Link href={href} className="text-sm text-ink-muted transition hover:text-brand-600">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-[12.5px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SkillSpring. All rights reserved.</p>
          <p>Payments are processed securely by Razorpay. We never store card details.</p>
        </div>
      </div>
    </footer>
  );
}
