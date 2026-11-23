import type { Metadata } from "next";
import { FaqList, generalFaqs } from "@/components/site/faq-list";

export const metadata: Metadata = { title: "FAQs" };

const more = [
  { q: "Can I access a course on my phone?", a: "Yes. Proofwork works on any modern mobile, tablet or desktop browser." },
  { q: "How long do I have access to a course?", a: "Purchased courses remain available in your dashboard unless the purchase is refunded or access is revoked for a breach of our Terms." },
  { q: "Can I get a GST invoice?", a: "Contact support with your order reference and GSTIN and we will help." },
  { q: "How can an employer verify my certificate?", a: "Share your certificate ID or the verification link printed on it. Anyone can check it at Proofwork's /verify page." },
];

export default function FaqPage() {
  const items = [...generalFaqs, ...more];
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <div className="container-page max-w-3xl py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1 className="text-4xl font-bold">Frequently asked questions</h1>
      <div className="mt-8"><FaqList items={items} /></div>
    </div>
  );
}
