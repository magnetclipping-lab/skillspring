import { ChevronDown } from "lucide-react";

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((f) => (
        <details key={f.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg font-display text-[18px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marigold-400">
            {f.q}
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink/5 transition group-open:rotate-180 group-open:bg-marigold-400 group-open:text-canvas"><ChevronDown className="size-4" aria-hidden /></span>
          </summary>
          <p className="mt-3 max-w-[68ch] pr-12 text-[15.5px] leading-7 text-ink-soft">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export const generalFaqs = [
  { q: "Who is Proofwork for?", a: "College students, commerce, management and engineering students, and fresh graduates across India who want practical, job-relevant skills." },
  { q: "How do certificates work?", a: "A certificate is issued only after you complete every mandatory lesson, submit required assignments and pass the course quizzes. Each certificate has a unique ID and a public verification page employers can check." },
  { q: "Are the internships real jobs?", a: "Listings are clearly labelled. “Employer internship” listings come from verified employers. “Educational simulation” and “Project-based experience” listings are learning experiences run by Proofwork — they are not jobs or employer placements." },
  { q: "Do you guarantee placements?", a: "No. We do not promise jobs, placements or salaries. We focus on teaching skills and helping you build a portfolio of real work." },
  { q: "How are payments handled?", a: "Payments are processed by Razorpay using UPI, cards, net banking or wallets. Proofwork never sees or stores your card details. Access is granted only after the payment is verified on our server." },
  { q: "What is your refund policy?", a: "See our Refund Policy for the eligibility window and conditions. Approved refunds are processed back to the original payment method via Razorpay." },
];
