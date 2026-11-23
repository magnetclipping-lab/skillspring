import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FlaskConical, Search, SearchX } from "lucide-react";
import { InternshipCard } from "@/components/site/cards";
import { AutoSubmitForm } from "@/components/site/auto-submit-form";
import { Button } from "@/components/ui/button";
import { EmptyState, Input, Select } from "@/components/ui/primitives";
import { getInternships } from "@/lib/data/catalogue";

export const metadata: Metadata = {
  title: "Internships & project experiences",
  description: "Browse employer internships and Proofwork educational simulations and projects.",
  alternates: { canonical: "/internships" },
};

export default async function InternshipsPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; mode?: string; paid?: string }> }) {
  const sp = await searchParams;
  const list = await getInternships({ q: sp.q?.slice(0, 80), kind: sp.kind, mode: sp.mode, paid: sp.paid });

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="max-w-3xl">
        <p className="eyebrow">Internship portal</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Internships & project experiences</h1>
        <p className="mt-2 text-ink-muted">Gain practical experience. Every listing tells you exactly what it is.</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10/60 p-4">
          <Building2 className="mt-0.5 size-5 shrink-0 text-emerald-300" />
          <p className="text-sm text-emerald-300"><strong>Employer internship</strong> — a role offered by a verified employer. Selection is made by the employer.</p>
        </div>
        <div className="flex gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/10/60 p-4">
          <FlaskConical className="mt-0.5 size-5 shrink-0 text-violet-300" />
          <p className="text-sm text-violet-900"><strong>Educational simulation / project</strong> — a learning experience run by Proofwork. Not a job or employer placement.</p>
        </div>
      </div>

      <AutoSubmitForm action="/internships" role="search" className="mt-6 grid gap-3 rounded-2xl border border-line bg-surface p-3 shadow-soft md:grid-cols-[1.6fr_repeat(3,1fr)_auto]">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input name="q" defaultValue={sp.q} placeholder="Search by title or skill…" className="pl-9" />
        </label>
        <label><span className="sr-only">Type</span>
          <Select name="kind" defaultValue={sp.kind ?? ""}>
            <option value="">All types</option>
            <option value="employer">Employer internships</option>
            <option value="educational">Simulations & projects</option>
          </Select>
        </label>
        <label><span className="sr-only">Work mode</span>
          <Select name="mode" defaultValue={sp.mode ?? ""}>
            <option value="">Any mode</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </Select>
        </label>
        <label><span className="sr-only">Stipend</span>
          <Select name="paid" defaultValue={sp.paid ?? ""}>
            <option value="">Paid & unpaid</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </Select>
        </label>
        <Button type="submit">Apply</Button>
      </AutoSubmitForm>

      <p className="mt-6 text-sm text-ink-muted" aria-live="polite">{list.length} {list.length === 1 ? "opportunity" : "opportunities"}</p>
      {list.length ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((i) => <InternshipCard key={i.id} internship={i} />)}
        </div>
      ) : (
        <EmptyState className="mt-6" icon={<SearchX className="size-5" />} title="No opportunities match" description={sp.kind === "employer" ? "There are no employer internships listed right now. Employers can partner with us to list roles." : "Try different filters."} action={<Link href="/internships" className="text-sm font-semibold text-brand-300 hover:underline">Clear filters</Link>} />
      )}
    </div>
  );
}
