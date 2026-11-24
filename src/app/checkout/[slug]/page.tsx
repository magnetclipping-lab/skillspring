import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Lock, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { getCourseBySlug, isPurchasable } from "@/lib/data/catalogue";
import { integrationStatus } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";
import { Alert, Card } from "@/components/ui/primitives";
import { Logo } from "@/components/site/logo";
import { formatINR } from "@/lib/utils";
import { CheckoutButton } from "./checkout-button";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser(`/checkout/${slug}`);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();

  const supabase = await createClient();
  const { data: enrolment } = await supabase.from("enrolments").select("status").eq("course_id", course.id).eq("user_id", user.id).maybeSingle();
  if (enrolment?.status === "active") redirect(`/dashboard/learning/${slug}`);

  const status = integrationStatus();
  const buyable = isPurchasable(course) && course.effective_price > 0;

  return (
    <main id="main" className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-surface">
        <div className="container-page flex h-16 items-center justify-between">
          <Logo />
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-muted"><Lock className="size-3.5" />Secure checkout</span>
        </div>
      </header>
      <div className="container-page max-w-4xl py-10">
        <Link href={`/courses/${slug}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 hover:underline"><ArrowLeft className="size-4" />Back to course</Link>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Complete your enrolment</h1>
        <div className="mt-6 grid gap-6 md:grid-cols-[1.3fr_1fr]">
          <Card className="overflow-hidden">
            <div className="flex gap-4 p-5">
              <div className="relative aspect-[16/9] w-36 shrink-0 overflow-hidden rounded-xl bg-brand-900">
                {course.thumbnail_url ? <Image src={course.thumbnail_url} alt="" fill className="object-cover" sizes="144px" unoptimized={course.thumbnail_url.endsWith(".svg")} /> : null}
              </div>
              <div>
                <p className="font-display font-semibold">{course.title}</p>
                <p className="mt-1 text-sm text-ink-muted">{course.instructor?.display_name ?? "Proofwork"}</p>
              </div>
            </div>
            <div className="border-t border-line p-5 text-sm">
              <p className="font-semibold">Billed to</p>
              <p className="mt-1 text-ink-soft">{user.profile.full_name || "—"} · {user.email}</p>
            </div>
          </Card>
          <Card className="p-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-muted">Course price</dt><dd>{formatINR(course.price_paise, true)}</dd></div>
              {course.effective_price < course.price_paise ? <div className="flex justify-between text-emerald-300"><dt>Discount</dt><dd>−{formatINR(course.price_paise - course.effective_price, true)}</dd></div> : null}
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd>{formatINR(course.effective_price, true)}</dd></div>
            </dl>
            <p className="mt-2 text-[12px] text-ink-muted">Prices are inclusive of applicable taxes. The final amount is confirmed by our server.</p>
            <div className="mt-5">
              {!buyable ? (
                <Alert tone="warning">This course is not available for purchase yet.</Alert>
              ) : !status.razorpay ? (
                <Alert tone="warning" title="Payments not configured">Razorpay keys have not been added to this environment, so checkout is disabled. No payment can be taken.</Alert>
              ) : (
                <CheckoutButton slug={slug} amountLabel={formatINR(course.effective_price, true)} testMode={!status.razorpayLiveMode} />
              )}
            </div>
            <p className="mt-4 flex items-start gap-2 text-[12px] text-ink-muted"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />Payments are processed by Razorpay. Proofwork never sees or stores your card details. By paying you agree to our <Link href="/terms" className="underline">Terms</Link> and <Link href="/refund-policy" className="underline">Refund Policy</Link>.</p>
          </Card>
        </div>
      </div>
    </main>
  );
}
