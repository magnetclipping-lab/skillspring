import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, CalendarClock, CheckCircle2, Clock, ExternalLink, FlaskConical, MapPin, Users, Wallet } from "lucide-react";
import { getSessionUser } from "@/lib/auth/dal";
import { getInternshipBySlug } from "@/lib/data/catalogue";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { InternshipKindBadge, stipendLabel } from "@/components/site/cards";
import { formatDate, titleCase } from "@/lib/utils";
import { ApplyForm, SaveButton } from "./client";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const i = await getInternshipBySlug(slug);
  return i ? { title: i.title, description: i.description.slice(0, 155), alternates: { canonical: `/internships/${i.slug}` } } : { title: "Not found" };
}

export default async function InternshipPage({ params }: Props) {
  const { slug } = await params;
  const i = await getInternshipBySlug(slug);
  if (!i) notFound();
  const user = await getSessionUser();
  let application: { status: string; created_at: string } | null = null;
  let saved = false;
  if (user && isSupabaseConfigured()) {
    const supabase = await createClient();
    const [{ data: a }, { data: s }] = await Promise.all([
      supabase.from("internship_applications").select("status, created_at").eq("internship_id", i.id).eq("user_id", user.id).maybeSingle(),
      supabase.from("saved_internships").select("id").eq("internship_id", i.id).eq("user_id", user.id).maybeSingle(),
    ]);
    application = a;
    saved = Boolean(s);
  }
  const deadlinePassed = i.deadline ? new Date(i.deadline + "T23:59:59+05:30") < new Date() : false;
  const open = i.status === "open" && !deadlinePassed;

  // JobPosting structured data only for genuine employer internships.
  const jsonLd = i.kind === "employer" && i.employer ? {
    "@context": "https://schema.org", "@type": "JobPosting", title: i.title, description: i.description,
    datePosted: i.created_at, validThrough: i.deadline ?? undefined, employmentType: "INTERN",
    hiringOrganization: { "@type": "Organization", name: i.employer.name, sameAs: i.employer.website ?? undefined },
    jobLocationType: i.work_mode === "remote" ? "TELECOMMUTE" : undefined, url: `${publicEnv.siteUrl}/internships/${i.slug}`,
  } : null;

  return (
    <div className="container-page py-10">
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /> : null}
      <Link href="/internships" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" />All opportunities</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-8">
          <div>
            <div className="flex flex-wrap gap-2"><InternshipKindBadge kind={i.kind} />{!open ? <Badge>Applications closed</Badge> : null}</div>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{i.title}</h1>
            <p className="mt-2 flex items-center gap-2 text-ink-muted">
              {i.kind === "employer" && i.employer ? (
                <>{i.employer.name}{i.employer.website ? <a href={i.employer.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline">Website <ExternalLink className="size-3" /></a> : null}</>
              ) : "Run by SkillSpring"}
            </p>
          </div>

          {i.kind !== "employer" ? (
            <Alert tone="info" title="This is an educational experience, not a job">
              {i.kind === "simulation" ? "This simulation" : "This project"} is designed and run by SkillSpring to help you practise real-world skills and build your portfolio. It is not an employer internship, placement or offer of employment.
            </Alert>
          ) : null}

          <section>
            <h2 className="text-xl font-bold">About</h2>
            <p className="mt-3 whitespace-pre-line leading-7 text-ink-soft">{i.description}</p>
          </section>
          {i.responsibilities.length ? (
            <section>
              <h2 className="text-xl font-bold">What you&apos;ll do</h2>
              <ul className="mt-3 space-y-2">{i.responsibilities.map((r) => <li key={r} className="flex gap-2.5 text-ink-soft"><CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-500" />{r}</li>)}</ul>
            </section>
          ) : null}
          {i.skills.length ? (
            <section>
              <h2 className="text-xl font-bold">Skills required</h2>
              <div className="mt-3 flex flex-wrap gap-2">{i.skills.map((s) => <span key={s} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-ink-soft ring-1 ring-line">{s}</span>)}</div>
            </section>
          ) : null}
          {i.eligibility ? (
            <section>
              <h2 className="text-xl font-bold">Eligibility</h2>
              <p className="mt-3 text-ink-soft">{i.eligibility}</p>
            </section>
          ) : null}

          <section id="apply" className="scroll-mt-24">
            <h2 className="text-xl font-bold">Apply</h2>
            <div className="mt-4">
              {application ? (
                <Alert tone="success" title="You've applied">
                  Submitted {formatDate(application.created_at)} · Status: <strong>{titleCase(application.status)}</strong>. <Link href="/dashboard/applications" className="font-semibold underline">Track application</Link>
                </Alert>
              ) : !open ? (
                <Alert tone="warning">Applications for this opportunity are closed.</Alert>
              ) : !user ? (
                <Card className="p-6">
                  <p className="text-ink-soft">Log in or create a free account to apply.</p>
                  <div className="mt-4 flex gap-3">
                    <ButtonLink href={`/login?next=/internships/${i.slug}%23apply`}>Log in to apply</ButtonLink>
                    <ButtonLink href={`/register?next=/internships/${i.slug}%23apply`} variant="secondary">Create account</ButtonLink>
                  </div>
                </Card>
              ) : (
                <ApplyForm internshipId={i.id} defaultPhone={user.profile.phone} />
              )}
            </div>
          </section>
        </div>

        <aside>
          <Card className="sticky top-24 p-6">
            <dl className="space-y-4 text-sm">
              {[
                { icon: MapPin, k: "Work mode", v: `${titleCase(i.work_mode)}${i.location ? ` · ${i.location}` : ""}` },
                { icon: Clock, k: "Duration", v: i.duration_weeks ? `${i.duration_weeks} weeks` : "Flexible" },
                { icon: Wallet, k: "Stipend", v: `${stipendLabel(i)}${i.stipend_notes ? ` — ${i.stipend_notes}` : ""}` },
                { icon: CalendarClock, k: "Apply by", v: i.deadline ? formatDate(i.deadline) : "Rolling" },
                { icon: Users, k: "Positions", v: i.positions ? String(i.positions) : i.kind === "employer" ? "Not specified" : "Open to all eligible students" },
                { icon: i.kind === "employer" ? Briefcase : FlaskConical, k: "Type", v: i.kind === "employer" ? "Employer internship" : i.kind === "simulation" ? "Educational simulation" : "Project-based experience" },
              ].map(({ icon: Icon, k, v }) => (
                <div key={k} className="flex gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-ink-muted" />
                  <div><dt className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">{k}</dt><dd className="mt-0.5 text-ink">{v}</dd></div>
                </div>
              ))}
            </dl>
            <div className="mt-6 grid gap-2">
              {open && !application ? <ButtonLink href="#apply">Apply now</ButtonLink> : null}
              {user ? <SaveButton internshipId={i.id} slug={i.slug} saved={saved} /> : null}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
