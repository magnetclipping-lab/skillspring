import { Alert } from "@/components/ui/primitives";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="container-page max-w-3xl py-14">
      <h1 className="text-4xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-ink-muted">Last updated: {updated}</p>
      <Alert tone="warning" className="mt-6" title="Template — legal review required">This document is a starting template prepared for SkillSpring. Have it reviewed by a qualified Indian lawyer and fill in your registered entity details before launch.</Alert>
      <div className="prose-legal mt-8">{children}</div>
    </div>
  );
}
