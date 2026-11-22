import Link from "next/link";
import { publicEnv } from "@/lib/env";
import { Logo } from "./logo";

const cols = [
  { title: "Programs", links: [["Stock Market", "/programs/stock-market-program"], ["Web Design & Development", "/programs/web-development-program"], ["Digital Marketing", "/programs/digital-marketing-program"], ["Excel for Finance & Business", "/programs/excel-program"]] },
  { title: "Get involved", links: [["Campus Ambassador", "/campus-ambassador"], ["Internships & projects", "/internships"], ["Teach with us", "/become-instructor"], ["Partner with us", "/partners"], ["Verify a certificate", "/verify"]] },
  { title: "Company", links: [["About", "/about"], ["FAQs", "/faq"], ["Contact", "/contact"], ["Privacy policy", "/privacy"], ["Terms & conditions", "/terms"], ["Refund policy", "/refund-policy"], ["Disclaimer", "/disclaimer"]] },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-ink/8 bg-white">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[15px] leading-6 text-ink-muted">Practical programs in stock markets, web development, digital marketing and Excel, built for students across India.</p>
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
