# Architecture & security decisions

## Authorisation model (defence in depth)
1. **Proxy (`src/proxy.ts`).** Refreshes the Supabase session and redirects signed-out users away from private routes. This step is only a convenience, not a security boundary.
2. **Data access layer (`src/lib/auth/dal.ts`).** `requireUser`, `requireAdmin` and `requireInstructor` read roles from the `user_roles` table on every request, never from client input or JWT metadata. Every server action and route handler calls one of them.
3. **Row Level Security.** Every public table has RLS enabled, and helper functions live in a `private` schema that isn't exposed through the API. Students see only their own orders, payments, progress, submissions, applications and certificates. Instructors see only their own courses, enrolments and earnings. Admin access is explicit.
4. **Column guards.** Triggers stop non-admins from changing protected columns: course status, rights, demo flag and owner; profile suspension; instructor status and revenue share; submission review fields.
5. **Server-only writes for money and credentials.** Orders, payments, enrolments, refunds, earnings and certificates have no client insert/update policies. They change only through `SECURITY DEFINER` functions (`fulfil_order`, `apply_refund`, `issue_certificate`, `complete_lesson`, …) that re-check the caller, or through the service role inside verified server code.

## Things the client is never trusted with
- **Price:** read from the database (`course_effective_price`). `fulfil_order` also rejects amount mismatches.
- **Payment success:** requires the HMAC signature, a re-fetch from the Razorpay API, and the webhook as backup.
- **Progress percentage and completion:** computed in SQL.
- **Quiz answers:** `quiz_questions` can't be read by students; grading happens in `submit_quiz_attempt`.
- **Roles:** stored in the database and granted only by admins.

## Other controls
- Zod validation on every input; allow-listed redirects (`safeRedirectPath`); https-only external links.
- A custom safe Markdown renderer for lessons, so no raw HTML is ever rendered.
- Rate limiting in Postgres (works across serverless instances) on login, registration, password reset, contact, checkout, payment verification, applications, uploads, quizzes and certificate verification.
- Same-origin checks on JSON route handlers (Server Actions have built-in origin checks).
- Security headers: CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy. `no-store` on private pages.
- Uploads: size limits, magic-byte sniffing, random object names, per-user/per-course folders enforced by Storage RLS, and signed URLs that expire after 60 seconds.
- CSV exports neutralise spreadsheet formula injection.
- Audit log for admin actions, payments, refunds, certificates and exports.
- No card data is ever handled; Razorpay Checkout collects it.

## Notable technical choices
- **`cacheComponents` is disabled** in `next.config.ts`. Almost every page depends on the session, and classic dynamic rendering is simpler and safer to maintain. `getSessionUser()` calls `connection()` so private pages are never prerendered.
- **Tailwind 4 + hand-written components in the shadcn style.** The shadcn CLI needs network access at scaffold time; the components follow the same patterns.
- **Razorpay through its REST API** with `fetch`, not the SDK. This means fewer dependencies and fully testable code.
- **Video:** lessons store only a provider playback ID. Signed tokens (RS256) are minted per viewer after an enrolment check, using `jose`.
- **Money** is stored as integer paise everywhere.
