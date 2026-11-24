# Build status — Proofwork platform

Branch: `redesign-proofwork`. Production (`main`) still runs the old SkillSpring/Proofwork site until this branch is merged.

## Verified in the build environment
- `npm run build` succeeds; TypeScript and ESLint clean.
- Unit tests (39): validation, typed quiz parsing, upload sniffing (XLSX/CSV/MP4), upload folder scoping, AI evaluation output validation, Anthropic call handling (mocked), XLSX formula/value extraction, DOCX extraction, template path safety.
- Database tests (52) against Postgres 16 with all migrations: RLS, payments, quiz grading for all six question types, answer-key secrecy, 60-minute evaluation queue, duplicate-safe job claiming, superseded versions, human override with history, catalogue seed (24 courses × ₹7,500, four assignment kinds, rubrics and keys), explanation withholding.
- Public end-to-end tests (38, desktop + mobile) in preview mode.

## Catalogue
- Content lives in `scripts/catalogue/*.py`; `npm run catalogue:build` regenerates the seed migration
  (`supabase/migrations/20261125000010_proofwork_catalogue.sql`), `src/lib/catalogue/catalogue.json` (preview mode),
  thumbnails and the private assignment templates in `private/templates/` (24 workbooks + 24 Word briefs).
- Lesson pages are outlines marked "being finalised" — real lesson videos/notes still need to be produced and added in Admin.
- Preview videos: none uploaded yet. Course cards show an honest "Preview video coming soon" until an admin uploads one (Admin → Courses → course → 30-second preview).
- Instructors are hidden on the site until approved instructor profiles exist.

## Assignment evaluation
1. Learner submits → stored, versioned → `Pending evaluation` (runs ~60 minutes later; the learner can still change it).
2. A durable job row in `evaluation_jobs` is created by a database trigger (no browser timers).
3. `/api/cron/evaluate` claims due jobs (`FOR UPDATE SKIP LOCKED`), extracts the file (XLSX formulas + values, DOCX text, PPTX text, PDF/images native), calls Claude with the rubric and private answer key, validates the result and records it. Low-confidence or inconsistent results go to human review. Failures retry up to 3 times, then go to human review.
4. Learner gets a notification; marks and per-criterion feedback appear in Dashboard → Results.
5. Admin → Review queue: confirm/override any mark (history kept), re-run AI, evaluate now, or process due jobs.

## Needs your action / credentials
| Item | Where |
|---|---|
| `ANTHROPIC_API_KEY` (and optional `ANTHROPIC_MODEL`, default `claude-sonnet-5-5`) | Vercel env. Without it, submissions go to human review — no marks are invented. |
| Scheduler | Run `supabase/scheduler/evaluation_scheduler.sql` in Supabase (enables pg_cron + pg_net, calls the worker every 5 min). Set `site_url` in `private.app_settings` to the production domain. Alternative: `CRON_SECRET` + an external cron calling `GET /api/cron/evaluate` with `Authorization: Bearer <secret>`. |
| Live DB migrations not yet applied | `20261125000009_completion_rules.sql`, `20261125000010_proofwork_catalogue.sql`, `20261125000011_catalogue_helpers.sql` — apply when merging, because 000010 archives the old four programs that the current production code still shows. |
| Razorpay live keys + webhook secret | already supported; set before taking real payments. |

## Not yet verified
- Full journeys (`E2E_FULL=1 npx playwright test e2e/journeys.spec.ts`) need a non-production Supabase project and Razorpay test keys.
- A live Claude evaluation end to end (needs the API key).
