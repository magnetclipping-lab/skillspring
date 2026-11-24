import type { Metadata } from "next";
import { FaqList, generalFaqs } from "@/components/site/faq-list";

export const metadata: Metadata = { title: "FAQs" };

const more = [
  { q: "Can I access a course on my phone?", a: "Yes. Proofwork works on any modern mobile, tablet or desktop browser." },
  { q: "How long do I have access to a course?", a: "Purchased courses remain available in your dashboard unless the purchase is refunded or access is revoked for a breach of our Terms." },
  { q: "Can I get a GST invoice?", a: "Contact support with your order reference and GSTIN and we will help." },
  { q: "Can I resubmit an assignment?", a: "Yes. Each resubmission is saved as a new version and evaluated again. Your full submission history stays in your dashboard." },
  { q: "What happens if I disagree with a mark?", a: "Reply through Contact with the assignment name. A member of the Proofwork team reviews the submission against the rubric and can adjust the mark." },
];

export default function FaqPage() {
  const items = [...generalFaqs, ...more];
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <div className="container-page max-w-3xl py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="display text-[44px] sm:text-[56px]">Frequently asked questions</h1>
      <div className="mt-8"><FaqList items={items} /></div>
    </div>
  );
}
