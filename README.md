# SkillSpring

An Indian EdTech and internship marketplace: course catalogue, Razorpay checkout, an LMS with quizzes, assignments and verifiable certificates, an internship portal, an instructor portal and an admin console.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide, Zod · Supabase (Postgres, Auth, Storage, RLS) · Razorpay · Mux or Cloudflare Stream · Resend · Vercel.

> **Status:** see [docs/STATUS.md](docs/STATUS.md) for what is fully working, what still needs credentials, and what is still incomplete.

---

## 1. Local setup

```bash
npm install
cp .env.example .env.local        # fill in values (see sections below)
npm run dev                       # http://localhost:3000
```

**Preview mode.** If Supabase variables aren't set, the site still runs. Public pages show the demo catalogue from `src/lib/demo/seed-data.ts`, a yellow banner explains that preview mode is on, and sign-in and purchases are disabled. Nothing is faked.

### Local Supabase (recommended)

You need Docker and the [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase start                    # starts Postgres, Auth, Storage, Studio and Inbucket
supabase db reset                 # applies supabase/migrations/* and supabase/seed.sql
supabase status                   # copy API URL, anon key and service_role key into .env.local
```

Confirmation emails show up in Inbucket at http://localhost:54324.

### Make yourself an admin

Register through the site, then run this in Supabase Studio's SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from public.profiles where email = 'you@example.com';
```

## 2. Supabase configuration (hosted project)

1. Create a project in the **Mumbai (ap-south-1)** region.
2. Apply the schema: either `supabase link --project-ref <ref>` followed by `supabase db push`, or paste each file in `supabase/migrations/` (in order) into the SQL editor.
3. Seed the demo catalogue with `psql "$DATABASE_URL" -f supabase/seed.sql`, or paste the file into the SQL editor. If you edit `src/lib/demo/seed-data.ts`, run `npm run seed:generate` to regenerate it.
4. **Auth → URL configuration:** set Site URL to `https://yourdomain.in` and add `https://yourdomain.in/auth/confirm` to Redirect URLs.
5. **Auth → Email templates:** change the confirm-signup and reset-password links to the token-hash form:
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/dashboard` (signup) and
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` (recovery).
6. **Auth → SMTP:** use Resend as the custom SMTP server so auth emails come from your domain.
7. **Storage:** the buckets (`avatars`, `course-thumbnails`, `course-resources`, `assignment-submissions`, `resumes`) and their policies are created by migration `…0004_storage.sql`.
8. Copy the URL, anon key and **service_role** key into your environment. The service_role key must stay server-side only.

## 3. Razorpay configuration

1. Use **Test mode** keys (`rzp_test_…`) for `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. **Webhooks → Add:** URL `https://yourdomain.in/api/webhooks/razorpay`, with a secret that matches `RAZORPAY_WEBHOOK_SECRET`.
   Events: `payment.captured`, `payment.failed`, `order.paid`, `refund.created`, `refund.processed`, `refund.failed`.
3. **Payment capture:** set to automatic. The server also captures authorised payments itself if needed.
4. Go-live requires KYC, live keys and a live-mode webhook. See [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md).

**How a purchase works:** the server reads the price from the database and creates a Razorpay order. The browser opens Checkout. The server then verifies the HMAC signature and **re-fetches the payment from Razorpay** before calling the `fulfil_order()` database function, which locks the order, checks the amount and creates the enrolment exactly once. The webhook calls the same idempotent function, so it covers users who close the tab mid-payment. Duplicate webhooks are dropped using `webhook_events(provider, event_id)`.

### How to test a student purchase

1. Set Razorpay test keys and publish a course with cleared rights and `is_demo = false`. Do this in the admin console: **Courses → course → Rights = Owned → Approve → Publish**. Demo courses can never be bought.
2. Log in as a student, open the course and click **Buy now**, then **Pay**.
3. Use a Razorpay [test card or UPI ID](https://razorpay.com/docs/payments/payments/test-card-upi-details/), e.g. UPI `success@razorpay`.
4. You land on the course with "Payment verified". Check **Dashboard → Payments** and **Admin → Finance**.
5. For local webhooks, expose your dev server with a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and point a test webhook at it.

## 4. Video, email and file storage

- **Mux:** create assets with a *signed* playback policy, add a signing key, and put the base64 private key in `MUX_SIGNING_PRIVATE_KEY`. Paste each asset's playback ID into the lesson's "Playback / video ID" field. The server issues a 2-hour signed URL only after confirming the viewer is enrolled.
- **Cloudflare Stream** is the alternative: enable signed URLs and set the `CLOUDFLARE_STREAM_*` variables.
- **Resend:** verify your domain, then set `RESEND_API_KEY` and `EMAIL_FROM`. Every email is logged in `email_outbox` with status `sent`, `failed` or `skipped`.
- **Files:** uploads are validated by size and magic bytes, stored under random names, and private files are served only through 60-second signed URLs after an RLS-checked lookup.

## 5. Deploying to Vercel

1. Push to GitHub and import the repo in Vercel (framework: Next.js).
2. Add every variable from `.env.example` to Production, and use test keys for Preview. Set `NEXT_PUBLIC_SITE_URL` to your domain.
3. Deploy, then update the Supabase Auth URLs and the Razorpay webhook URL to the production domain.
4. Recommended region: `bom1` (Mumbai), close to the Supabase project.

## 6. Testing

| Command | What it covers |
|---|---|
| `npm run test` | Unit and API tests: Razorpay signatures, webhook idempotency, CSRF/auth guards, upload sniffing, validation, CSV injection, email escaping, catalogue filters |
| `npm run test:db` | **Database permission tests** against real Postgres: RLS, column guards, payment fulfilment, refunds, certificates, quiz secrecy, instructor workflow, privilege escalation. Needs a local Postgres (`PGHOST`/`PGUSER`/`PGPASSWORD`). It creates a throwaway `skillspring_vitest` database with a Supabase auth shim. |
| `npm run build && npm run test:e2e` | Playwright on desktop and mobile: public pages, filters, demo-course lock, labelling, SEO, security headers, responsive overflow, signed-out access denial |
| `npm run test:e2e:full` | Journeys 1–6 end to end. Needs Supabase and Razorpay **test** credentials in env. Refuses to run with live keys. |

## 7. Project layout

```
src/app/(site)        public website (home, catalogue, course, internships, legal, verify)
src/app/(auth)        login, register, password reset
src/app/dashboard     student dashboard     src/app/learn   distraction-free lesson player
src/app/instructor    instructor portal     src/app/admin   admin console
src/app/api           payments, Razorpay webhook, uploads, signed downloads, CSV exports
src/lib               auth DAL, Supabase clients, payments, email, video, validation, security
supabase/migrations   schema, RLS, RPC functions, storage policies
tests/ e2e/           Vitest (unit/api/db) and Playwright
docs/                 status, security notes, launch checklist
```

Architecture and security decisions are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
