import Link from "next/link";
import { publicEnv } from "@/lib/env";
import { getCategories } from "@/lib/data/catalogue";
import { LogoGlyph, Wordmark } from "./logo";

export async function SiteFooter() {
  const categories = await getCategories();
  const cols: { title: string; links: [string, string][] }[] = [
    { title: "Courses", links: [["All courses", "/courses"], ...categories.map((c) => [c.name, `/courses?category=${c.slug}`] as [string, string])] },
    { title: "Learn", links: [["How it works", "/#method"], ["Assignments & evaluation", "/#assignments"], ["FAQs", "/faq"], ["Campus Ambassador", "/campus-ambassador"], ["Teach with us", "/become-instructor"]] },
    { title: "Company", links: [["About", "/about"], ["Contact", "/contact"], ["Privacy policy", "/privacy"], ["Terms & conditions", "/terms"], ["Refund policy", "/refund-policy"], ["Disclaimer", "/disclaimer"]] },
  ];
  return (
    <footer className="mt-auto border-t border-line bg-surface/40">
      <div className="container-page grid gap-12 py-16 md:grid-cols-[1.3fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2" aria-label="Proofwork home">
            <LogoGlyph className="size-6" />
            <Wordmark />
          </Link>
          <p className="mt-4 max-w-xs text-[14.5px] leading-6 text-ink-muted">
            Practical courses in AI, marketing, professional tools and business — with assignments you actually complete and feedback you can act on.
          </p>
          <p className="mt-5 text-sm">
            <a className="font-medium text-ink-soft underline decoration-line underline-offset-4 hover:text-ink" href={`mailto:${publicEnv.supportEmail}`}>{publicEnv.supportEmail}</a>
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="kicker">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}><Link href={href} className="text-[14px] text-ink-soft transition hover:text-ink">{label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <div className="container-page flex flex-col gap-2 py-5 text-[12.5px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Proofwork. All prices in Indian rupees (INR).</p>
          <p>Payments are processed by Razorpay. Card details never touch our servers.</p>
        </div>
      </div>
    </footer>
  );
}
