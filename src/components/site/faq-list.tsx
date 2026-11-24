import { ChevronDown } from "lucide-react";

export function FaqList({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((f) => (
        <details key={f.q} className="group py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg font-display text-[18px] font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400">
            {f.q}
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-line transition group-open:rotate-180 group-open:border-violet-500 group-open:text-violet-300"><ChevronDown className="size-4" aria-hidden /></span>
          </summary>
          <p className="mt-3 max-w-[68ch] pr-12 text-[15.5px] leading-7 text-ink-soft">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

export const generalFaqs = [
  { q: "Who is Proofwork for?", a: "Working professionals, founders, freelancers and students who want practical skills in AI, digital marketing, Excel and business analysis — and want to practise them on real tasks, not just watch videos." },
  { q: "How much does a course cost?", a: "Every regular course costs ₹7,500, paid once. There are no subscriptions. You keep access to the course after you buy it." },
  { q: "How are assignments evaluated?", a: "Quizzes are marked instantly. Workbook, written, practical and scenario assignments are evaluated against a published rubric (and, where relevant, an answer key), usually about an hour after you submit. Evaluation is AI-assisted, and the Proofwork team can review and adjust any result. You get marks and written feedback for each criterion." },
  { q: "Do I get a certificate?", a: "When you complete a course's requirements you receive an internal Proofwork completion record. It is not an accredited qualification, and we do not claim it is recognised by any university, employer or regulator." },
  { q: "Do you guarantee jobs or placements?", a: "No. We do not promise jobs, placements, salaries or partnerships. We focus on teaching useful skills and giving you honest feedback on real work you can show." },
  { q: "How are payments handled?", a: "Payments are processed by Razorpay using UPI, cards, net banking or wallets. Proofwork never sees or stores your card details. Access is granted only after the payment is verified on our server." },
  { q: "What is your refund policy?", a: "You can request a refund within 7 days of purchase if you have completed less than 25% of the course. Approved refunds go back to the original payment method via Razorpay. See the Refund Policy for full conditions." },
];
