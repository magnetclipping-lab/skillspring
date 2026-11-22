# Production launch checklist

## Business & legal
- [ ] Register the legal entity; get GSTIN; put the entity name, address and grievance officer on the legal pages
- [ ] Have a lawyer review the Privacy Policy (DPDP Act 2023), Terms, Refund Policy and Disclaimer
- [ ] Sign written instructor agreements (content rights, revenue share, payout terms)
- [ ] Sign written content-licence agreements for any licensed material
- [ ] Verify each employer before marking them verified
- [ ] Replace demo courses with real content; set Rights to Owned/Licensed/Instructor-owned and untick Demo
- [ ] Remove or replace the placeholder testimonials once you have real, consented reviews

## Supabase
- [ ] Production project in ap-south-1, on a paid plan with point-in-time recovery
- [ ] All migrations applied; demo seed applied only if you want it
- [ ] Auth Site URL and redirect URLs set to the production domain; email templates use `/auth/confirm`
- [ ] Custom SMTP (Resend) configured; email confirmations enabled
- [ ] Leaked-password protection enabled; minimum password length ≥ 10
- [ ] First admin granted via SQL; MFA enabled on the Supabase dashboard account
- [ ] Run the Supabase Security Advisor and fix all warnings

## Razorpay
- [ ] KYC complete; live mode activated
- [ ] Live key ID and secret in Vercel Production only
- [ ] Live webhook → `/api/webhooks/razorpay` with all 6 events; secret in `RAZORPAY_WEBHOOK_SECRET`
- [ ] Auto-capture enabled
- [ ] One real low-value purchase and refund made end to end, then reconciled in Admin → Finance

## Vercel / app
- [ ] All env vars set (Production vs Preview kept separate; Preview uses test keys)
- [ ] `NEXT_PUBLIC_SITE_URL` set to the https production domain; custom domain + HTTPS working
- [ ] `RATE_LIMIT_SALT` set to a long random value
- [ ] Mux/Cloudflare signing keys configured; a signed video plays for an enrolled user and fails for a non-enrolled one
- [ ] `npm run lint && npm run typecheck && npm run test:all && npm run test:e2e:full` all pass against staging
- [ ] Error monitoring (e.g. Sentry) and uptime checks added
- [ ] robots.txt and sitemap.xml reachable; site submitted to Google Search Console
- [ ] Lighthouse run on home, catalogue and course pages (mobile)

## Operations
- [ ] Refund-request handling process (Admin → Messages → Finance → Refund)
- [ ] Monthly instructor payout process (Admin → Finance → Record payout → Mark paid with UTR)
- [ ] Review the audit log and the `webhook_events` errors weekly
