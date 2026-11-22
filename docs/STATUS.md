# Build status — what works, what needs credentials, what's incomplete

## Verified in the build environment
- `next build`, TypeScript and ESLint all pass with no errors.
- **65 Vitest tests pass:**
  - 32 database tests against real PostgreSQL 16 with a Supabase auth shim. They cover all six journeys at the database level (purchase → enrolment, completion → certificate → verification, internship apply/status, admin create → approve → publish, instructor submit → approve, privilege escalation), plus refunds, IDOR, quiz-answer secrecy, suspension, storage policies and rate limiting.
  - 33 unit and API tests.
- **32 Playwright tests pass** on desktop and mobile in preview mode: public site, filters, demo lock, internship labelling, SEO, security headers, responsiveness, and signed-out denial of admin, instructor, dashboard and checkout.

## Fully implemented (works once Supabase is connected)
Public site · auth (register, verify email, login, logout, forgot/reset password) · roles · student dashboard · LMS (modules, lessons, video, text, PDFs/resources, quizzes, assignments, progress, resume learning) · configurable completion rules · certificates (issue, print/PDF, public verification, admin revoke) · internship portal (search, filters, save, apply with resume, withdraw, status tracking) · instructor portal (authoring, submit for review, submissions grading, earnings, payouts) · admin console (overview from live data, course review/publish/rights/demo, students, suspend, roles, grant/revoke access, instructors, internships, employers and employer accounts, applications with CSV export, finance with refunds/payouts/CSV, certificates, messages, audit log) · in-app notifications · email outbox.

## Implemented but needs your credentials
| Integration | Variables | Without them |
|---|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Preview mode (public demo pages only) |
| Razorpay | `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Checkout disabled with a clear notice; nothing is simulated |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Emails logged as `skipped`, not sent |
| Mux / Cloudflare Stream | `MUX_SIGNING_*` (+ `MUX_TOKEN_*` for uploads) or `CLOUDFLARE_STREAM_*` | Video lessons show "playback not configured" |

The admin overview page shows the live status of each integration.

## Not yet verified or still incomplete
- **Never run against a live Supabase / Razorpay / Resend / Mux.** The build sandbox had no network access to them. The six-journey browser suite (`e2e/journeys.spec.ts`) is written but has not been executed. Run `npm run test:e2e:full` once test credentials are set.
- Logged-in screens (dashboard, admin, instructor, lesson player) were type-checked and built but **not visually reviewed in a browser**, because they need a working Supabase session.
- **Content:** all 15 courses are demo listings with placeholder lessons. Testimonials are labelled placeholders. No employers exist. Legal pages are templates that need lawyer review and your entity details.
- **Not built (reasonable next steps):** GST invoices/receipts PDF, coupon codes, course bundles, a self-serve employer dashboard (employer members currently need an admin-created link and use the database functions; there is no dedicated UI), analytics/monitoring (e.g. Sentry), data-export/deletion self-service (handled via support), a background email-retry worker.
