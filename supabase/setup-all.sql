-- SkillSpring: complete database setup (all migrations + demo seed).
-- Paste into Supabase Dashboard -> SQL Editor -> New query -> Run. Run ONCE on a fresh project.

-- ===== supabase/migrations/20261122000001_schema.sql =====
-- =============================================================================
-- SkillSpring — core schema
-- Tables, enums, constraints, indexes and generic triggers.
-- RLS policies live in 0002, RPC functions in 0003, storage in 0004.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('student', 'instructor', 'admin');
create type public.course_status as enum ('draft', 'pending_review', 'changes_requested', 'approved', 'published', 'archived');
create type public.rights_status as enum ('pending', 'owned', 'licensed', 'instructor_owned', 'rejected');
create type public.course_level as enum ('beginner', 'intermediate', 'advanced');
create type public.lesson_type as enum ('video', 'text', 'pdf', 'external', 'assignment', 'quiz');
create type public.enrolment_status as enum ('active', 'refunded', 'revoked');
create type public.enrolment_source as enum ('purchase', 'free', 'admin_grant');
create type public.order_status as enum ('created', 'attempted', 'paid', 'failed', 'refunded', 'partially_refunded');
create type public.payment_status as enum ('authorized', 'captured', 'failed', 'refunded', 'partially_refunded');
create type public.refund_status as enum ('requested', 'pending', 'processed', 'failed', 'rejected');
create type public.internship_kind as enum ('employer', 'simulation', 'project');
create type public.work_mode as enum ('remote', 'hybrid', 'onsite');
create type public.internship_status as enum ('draft', 'open', 'closed', 'archived');
create type public.application_status as enum ('submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'selected', 'rejected', 'withdrawn');
create type public.employer_status as enum ('pending', 'verified', 'rejected', 'suspended');
create type public.instructor_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.certificate_status as enum ('valid', 'revoked');
create type public.payout_status as enum ('pending', 'processing', 'paid', 'failed', 'cancelled');
create type public.submission_status as enum ('submitted', 'approved', 'needs_revision');

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  email text,
  phone text check (phone is null or phone ~ '^\+?[0-9 \-]{7,20}$'),
  avatar_url text,
  college text check (char_length(college) <= 200),
  degree text check (char_length(degree) <= 120),
  graduation_year int check (graduation_year is null or graduation_year between 1980 and 2100),
  skills text[] not null default '{}',
  bio text check (char_length(bio) <= 2000),
  is_suspended boolean not null default false,
  suspended_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_idx on public.user_roles (user_id);

create table public.instructor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 120),
  headline text check (char_length(headline) <= 200),
  bio text check (char_length(bio) <= 4000),
  expertise text[] not null default '{}',
  website text,
  linkedin_url text,
  avatar_url text,
  status public.instructor_status not null default 'pending',
  default_revenue_share_pct numeric(5,2) not null default 0 check (default_revenue_share_pct between 0 and 100),
  payout_details_note text, -- free-text note only; never store bank/card numbers here
  is_demo boolean not null default false,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index instructor_profiles_status_idx on public.instructor_profiles (status);

create table public.employers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  website text,
  description text,
  logo_url text,
  industry text,
  location text,
  status public.employer_status not null default 'pending',
  is_demo boolean not null default false,
  verified_by uuid references public.profiles (id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.employer_members (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.employers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (employer_id, user_id)
);
create index employer_members_user_idx on public.employer_members (user_id);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  subtitle text check (char_length(subtitle) <= 240),
  description text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  instructor_id uuid references public.instructor_profiles (id) on delete set null,
  thumbnail_url text,
  price_paise int not null default 0 check (price_paise >= 0),
  discount_price_paise int check (discount_price_paise is null or discount_price_paise >= 0),
  discount_ends_at timestamptz,
  level public.course_level not null default 'beginner',
  language text not null default 'English',
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  learning_outcomes text[] not null default '{}',
  requirements text[] not null default '{}',
  faqs jsonb not null default '[]'::jsonb check (jsonb_typeof(faqs) = 'array'),
  status public.course_status not null default 'draft',
  rights_status public.rights_status not null default 'pending',
  rights_notes text,
  is_demo boolean not null default false,
  -- Configurable completion rules
  completion_requires_all_lessons boolean not null default true,
  completion_requires_assignments boolean not null default true,
  completion_min_quiz_pct int check (completion_min_quiz_pct is null or completion_min_quiz_pct between 0 and 100),
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  constraint discount_below_price check (discount_price_paise is null or discount_price_paise < price_paise)
);
create index courses_status_idx on public.courses (status);
create index courses_category_idx on public.courses (category_id);
create index courses_instructor_idx on public.courses (instructor_id);
create index courses_search_idx on public.courses using gin (search);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index course_modules_course_idx on public.course_modules (course_id, position);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  type public.lesson_type not null default 'text',
  content_md text,
  video_provider text check (video_provider is null or video_provider in ('mux', 'cloudflare')),
  video_asset_id text, -- Mux playback ID or Cloudflare Stream video UID (never a public URL)
  external_url text check (external_url is null or external_url ~ '^https://'),
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  position int not null default 0,
  is_preview boolean not null default false,
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index lessons_module_idx on public.lessons (module_id, position);
create index lessons_course_idx on public.lessons (course_id);

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('pdf', 'file', 'link')),
  storage_path text, -- object path inside the private course-resources bucket
  external_url text check (external_url is null or external_url ~ '^https://'),
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now(),
  constraint resource_location check (storage_path is not null or external_url is not null)
);
create index lesson_resources_lesson_idx on public.lesson_resources (lesson_id);

-- ---------------------------------------------------------------------------
-- Commerce
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  amount_paise int not null check (amount_paise > 0),
  currency text not null default 'INR' check (currency = 'INR'),
  status public.order_status not null default 'created',
  razorpay_order_id text unique,
  receipt text not null unique,
  notes jsonb not null default '{}'::jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_course_idx on public.orders (course_id);
create index orders_status_idx on public.orders (status);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  razorpay_payment_id text not null unique,
  razorpay_signature text,
  amount_paise int not null check (amount_paise >= 0),
  currency text not null default 'INR',
  status public.payment_status not null,
  method text,
  error_code text,
  error_description text,
  verified_via text check (verified_via in ('checkout_signature', 'webhook')),
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_user_idx on public.payments (user_id);

create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete restrict,
  order_id uuid references public.orders (id) on delete set null,
  source public.enrolment_source not null,
  status public.enrolment_status not null default 'active',
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  last_lesson_id uuid references public.lessons (id) on delete set null,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index enrolments_course_idx on public.enrolments (course_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  razorpay_refund_id text unique,
  amount_paise int not null check (amount_paise > 0),
  reason text,
  status public.refund_status not null default 'requested',
  requested_by uuid references public.profiles (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index refunds_payment_idx on public.refunds (payment_id);

create table public.instructor_revenue_shares (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade, -- null = instructor default
  share_pct numeric(5,2) not null check (share_pct between 0 and 100),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);
create index revenue_shares_lookup_idx on public.instructor_revenue_shares (instructor_id, course_id, effective_from desc);

-- Ledger of instructor earnings. Positive rows on verified payment, negative rows on refund.
create table public.instructor_earnings (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  order_id uuid not null references public.orders (id) on delete restrict,
  refund_id uuid references public.refunds (id) on delete restrict,
  gross_paise int not null,
  share_pct numeric(5,2) not null,
  amount_paise int not null,
  payout_id uuid,
  created_at timestamptz not null default now(),
  unique (order_id, refund_id)
);
create unique index instructor_earnings_one_sale_idx on public.instructor_earnings (order_id) where refund_id is null;
create index instructor_earnings_instructor_idx on public.instructor_earnings (instructor_id, created_at desc);

create table public.instructor_payouts (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid not null references public.instructor_profiles (id) on delete restrict,
  amount_paise int not null check (amount_paise > 0),
  period_start date not null,
  period_end date not null,
  status public.payout_status not null default 'pending',
  reference text, -- bank/UPI transaction reference entered by finance
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start)
);
create index instructor_payouts_instructor_idx on public.instructor_payouts (instructor_id, created_at desc);
alter table public.instructor_earnings
  add constraint instructor_earnings_payout_fk foreign key (payout_id) references public.instructor_payouts (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Learning
-- ---------------------------------------------------------------------------
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  completed_at timestamptz,
  last_position_seconds int not null default 0 check (last_position_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index lesson_progress_user_course_idx on public.lesson_progress (user_id, course_id);

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null,
  description text,
  pass_pct int not null default 60 check (pass_pct between 0 and 100),
  max_attempts int check (max_attempts is null or max_attempts > 0),
  is_mandatory boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index quizzes_course_idx on public.quizzes (course_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  prompt text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  correct_index int not null check (correct_index >= 0),
  explanation text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (correct_index < jsonb_array_length(options))
);
create index quiz_questions_quiz_idx on public.quiz_questions (quiz_id, position);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null,
  score_pct int not null check (score_pct between 0 and 100),
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index quiz_attempts_user_quiz_idx on public.quiz_attempts (user_id, quiz_id);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  lesson_id uuid references public.lessons (id) on delete set null,
  title text not null,
  instructions text not null default '',
  is_mandatory boolean not null default true,
  allow_file boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_course_idx on public.assignments (course_id);

create table public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  text_response text check (char_length(text_response) <= 20000),
  file_path text, -- path inside private assignment-submissions bucket
  status public.submission_status not null default 'submitted',
  feedback text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, user_id),
  check (text_response is not null or file_path is not null)
);
create index assignment_submissions_course_idx on public.assignment_submissions (course_id);

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  user_id uuid not null references public.profiles (id) on delete restrict,
  course_id uuid not null references public.courses (id) on delete restrict,
  enrolment_id uuid not null references public.enrolments (id) on delete restrict,
  student_name text not null,
  course_title text not null,
  issued_at timestamptz not null default now(),
  status public.certificate_status not null default 'valid',
  revoked_at timestamptz,
  revoked_reason text,
  revoked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table public.certificate_verifications (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid references public.certificates (id) on delete set null,
  code_queried text not null,
  found boolean not null,
  created_at timestamptz not null default now()
);
create index certificate_verifications_cert_idx on public.certificate_verifications (certificate_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, user_id)
);
create index reviews_course_idx on public.reviews (course_id) where is_published;

-- ---------------------------------------------------------------------------
-- Internships
-- ---------------------------------------------------------------------------
create table public.internships (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  employer_id uuid references public.employers (id) on delete set null,
  kind public.internship_kind not null,
  description text not null default '',
  responsibilities text[] not null default '{}',
  skills text[] not null default '{}',
  eligibility text,
  location text,
  work_mode public.work_mode not null default 'remote',
  duration_weeks int check (duration_weeks is null or duration_weeks between 1 and 104),
  is_paid boolean not null default false,
  stipend_min_inr int check (stipend_min_inr is null or stipend_min_inr >= 0),
  stipend_max_inr int check (stipend_max_inr is null or stipend_max_inr >= 0),
  stipend_notes text,
  deadline date,
  positions int check (positions is null or positions > 0),
  status public.internship_status not null default 'draft',
  is_demo boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A real "employer" internship must reference an employer record
  check (kind <> 'employer' or employer_id is not null),
  check (stipend_max_inr is null or stipend_min_inr is null or stipend_max_inr >= stipend_min_inr)
);
create index internships_status_idx on public.internships (status, deadline);
create index internships_employer_idx on public.internships (employer_id);

create table public.internship_applications (
  id uuid primary key default gen_random_uuid(),
  internship_id uuid not null references public.internships (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete cascade,
  resume_path text, -- path inside private resumes bucket
  cover_letter text check (char_length(cover_letter) <= 5000),
  phone text,
  portfolio_url text check (portfolio_url is null or portfolio_url ~ '^https?://'),
  status public.application_status not null default 'submitted',
  status_note text,
  status_updated_by uuid references public.profiles (id) on delete set null,
  status_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (internship_id, user_id)
);
create index internship_applications_internship_idx on public.internship_applications (internship_id, status);
create index internship_applications_user_idx on public.internship_applications (user_id);

create table public.saved_internships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  internship_id uuid not null references public.internships (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, internship_id)
);

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text check (link is null or link ~ '^/'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  subject text not null,
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  provider_message_id text,
  error text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  topic text not null check (topic in ('general', 'support', 'partner', 'instructor', 'employer', 'refund')),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) <= 254),
  organisation text check (char_length(organisation) <= 200),
  message text not null check (char_length(message) between 10 and 5000),
  user_id uuid references public.profiles (id) on delete set null,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

create table private.rate_limits (
  key text primary key,
  count int not null,
  window_start timestamptz not null
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','instructor_profiles','employers','categories','courses','course_modules','lessons',
    'orders','payments','enrolments','refunds','instructor_payouts','lesson_progress','quizzes',
    'quiz_questions','assignments','assignment_submissions','certificates','reviews','internships',
    'internship_applications'
  ] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- Keep lessons.course_id / lesson_resources.course_id consistent with their parents.
create or replace function private.sync_lesson_course()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select m.course_id into new.course_id from public.course_modules m where m.id = new.module_id;
  if new.course_id is null then
    raise exception 'Module % not found', new.module_id;
  end if;
  return new;
end $$;
create trigger sync_lesson_course before insert or update of module_id on public.lessons
  for each row execute function private.sync_lesson_course();

create or replace function private.sync_resource_course()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select l.course_id into new.course_id from public.lessons l where l.id = new.lesson_id;
  if new.course_id is null then
    raise exception 'Lesson % not found', new.lesson_id;
  end if;
  return new;
end $$;
create trigger sync_resource_course before insert or update of lesson_id on public.lesson_resources
  for each row execute function private.sync_resource_course();

-- New auth user → profile + student role.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(left(new.raw_user_meta_data ->> 'full_name', 120), ''))
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'student') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keep profile email in sync with auth email.
create or replace function private.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.handle_user_email_change();

-- ===== supabase/migrations/20261122000002_rls.sql =====
-- =============================================================================
-- SkillSpring — authorization helpers, column guards and Row Level Security
-- Principle: deny by default. Every table has RLS enabled. Writes that affect
-- money, enrolments, progress or certificates go through SECURITY DEFINER
-- functions (0003) or the server-only service role — never direct client writes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper functions (private schema: not exposed through the Data API)
-- ---------------------------------------------------------------------------
create or replace function private.has_role(r public.app_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid()) and ur.role = r and not p.is_suspended
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_role('admin');
$$;

create or replace function private.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and not is_suspended);
$$;

-- Roles that bypass column guards: service role, migration owner, and code running
-- inside SECURITY DEFINER functions (current_user = function owner), plus admins.
-- Deliberately SECURITY INVOKER so current_user reflects the caller.
create or replace function private.is_privileged()
returns boolean language sql stable set search_path = '' as $$
  select current_user not in ('authenticated', 'anon') or private.is_admin();
$$;

create or replace function private.current_instructor_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select ip.id from public.instructor_profiles ip
  join public.profiles p on p.id = ip.user_id
  where ip.user_id = (select auth.uid()) and ip.status = 'approved' and not p.is_suspended;
$$;

create or replace function private.owns_course(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses
    where id = c and instructor_id is not null and instructor_id = private.current_instructor_id()
  );
$$;

create or replace function private.is_enrolled(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.enrolments e
    join public.profiles p on p.id = e.user_id
    where e.user_id = (select auth.uid()) and e.course_id = c and e.status = 'active' and not p.is_suspended
  );
$$;

create or replace function private.can_view_content(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or private.owns_course(c) or private.is_enrolled(c);
$$;

create or replace function private.can_edit_course(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or exists (
    select 1 from public.courses
    where id = c and instructor_id = private.current_instructor_id()
      and status in ('draft', 'changes_requested')
  );
$$;

create or replace function private.course_is_public(c uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.courses where id = c and status = 'published');
$$;

create or replace function private.is_employer_member(e uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.employer_members m
    join public.employers emp on emp.id = m.employer_id
    join public.profiles p on p.id = m.user_id
    where m.employer_id = e and m.user_id = (select auth.uid())
      and emp.status = 'verified' and not p.is_suspended
  );
$$;

create or replace function private.internship_employer(i uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select employer_id from public.internships where id = i;
$$;

create or replace function private.lesson_course(l uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select course_id from public.lessons where id = l;
$$;

create or replace function private.quiz_course(q uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select course_id from public.quizzes where id = q;
$$;

-- ---------------------------------------------------------------------------
-- Column guards (SECURITY INVOKER so current_user reflects the caller)
-- ---------------------------------------------------------------------------
create or replace function private.guard_profiles()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then return new; end if;
  if new.is_suspended is distinct from old.is_suspended
     or new.suspended_reason is distinct from old.suspended_reason
     or new.email is distinct from old.email
     or new.id is distinct from old.id then
    raise exception 'Not allowed to change protected profile fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_profiles before update on public.profiles
  for each row execute function private.guard_profiles();

create or replace function private.guard_instructor_profiles()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.default_revenue_share_pct := 0;
    new.is_demo := false;
    new.reviewed_by := null; new.reviewed_at := null; new.review_notes := null;
    return new;
  end if;
  if new.status is distinct from old.status
     or new.default_revenue_share_pct is distinct from old.default_revenue_share_pct
     or new.is_demo is distinct from old.is_demo
     or new.user_id is distinct from old.user_id
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.review_notes is distinct from old.review_notes then
    raise exception 'Not allowed to change protected instructor fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_instructor_profiles before insert or update on public.instructor_profiles
  for each row execute function private.guard_instructor_profiles();

create or replace function private.guard_courses()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.rights_status := 'pending';
    new.rights_notes := null;
    new.is_demo := false;
    new.submitted_at := null; new.reviewed_by := null; new.reviewed_at := null;
    new.review_notes := null; new.published_at := null;
    new.instructor_id := private.current_instructor_id();
    new.created_by := (select auth.uid());
    return new;
  end if;
  if new.status is distinct from old.status
     or new.rights_status is distinct from old.rights_status
     or new.rights_notes is distinct from old.rights_notes
     or new.is_demo is distinct from old.is_demo
     or new.instructor_id is distinct from old.instructor_id
     or new.submitted_at is distinct from old.submitted_at
     or new.reviewed_by is distinct from old.reviewed_by
     or new.reviewed_at is distinct from old.reviewed_at
     or new.review_notes is distinct from old.review_notes
     or new.published_at is distinct from old.published_at
     or new.created_by is distinct from old.created_by then
    raise exception 'Not allowed to change protected course fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_courses before insert or update on public.courses
  for each row execute function private.guard_courses();

create or replace function private.guard_submissions()
returns trigger language plpgsql set search_path = '' as $$
declare reviewer boolean;
begin
  if private.is_privileged() then return new; end if;
  reviewer := private.owns_course(old.course_id);
  if old.user_id = (select auth.uid()) and not reviewer then
    -- Student editing their own submission: content only; resets to submitted.
    if new.status is distinct from old.status and new.status <> 'submitted'
       or new.feedback is distinct from old.feedback
       or new.reviewed_by is distinct from old.reviewed_by
       or new.reviewed_at is distinct from old.reviewed_at
       or new.assignment_id is distinct from old.assignment_id
       or new.course_id is distinct from old.course_id
       or new.user_id is distinct from old.user_id then
      raise exception 'Not allowed to change review fields' using errcode = '42501';
    end if;
    new.status := 'submitted';
    return new;
  end if;
  if reviewer then
    if new.text_response is distinct from old.text_response
       or new.file_path is distinct from old.file_path
       or new.user_id is distinct from old.user_id
       or new.assignment_id is distinct from old.assignment_id then
      raise exception 'Reviewers cannot change submission content' using errcode = '42501';
    end if;
    new.reviewed_by := (select auth.uid());
    new.reviewed_at := now();
    return new;
  end if;
  raise exception 'Not allowed' using errcode = '42501';
end $$;
create trigger guard_submissions before update on public.assignment_submissions
  for each row execute function private.guard_submissions();

create or replace function private.guard_notifications()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then return new; end if;
  if new.user_id is distinct from old.user_id or new.type is distinct from old.type
     or new.title is distinct from old.title or new.body is distinct from old.body
     or new.link is distinct from old.link or new.created_at is distinct from old.created_at then
    raise exception 'Only read status can be changed' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_notifications before update on public.notifications
  for each row execute function private.guard_notifications();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
alter table private.rate_limits enable row level security;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_admin_update on public.profiles for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- user_roles
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy user_roles_admin_write on public.user_roles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- instructor_profiles
create policy instructor_profiles_select on public.instructor_profiles for select to anon, authenticated
  using (status = 'approved' or user_id = (select auth.uid()) or private.is_admin());
create policy instructor_profiles_insert_own on public.instructor_profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_active_user());
create policy instructor_profiles_update_own on public.instructor_profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy instructor_profiles_admin on public.instructor_profiles for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- employers
create policy employers_select on public.employers for select to anon, authenticated
  using (status = 'verified' or private.is_employer_member(id) or private.is_admin());
create policy employers_admin on public.employers for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- employer_members
create policy employer_members_select on public.employer_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy employer_members_admin on public.employer_members for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- categories
create policy categories_select on public.categories for select to anon, authenticated using (true);
create policy categories_admin on public.categories for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- courses
-- Ownership is checked against the row's own columns so INSERT ... RETURNING works.
create policy courses_select on public.courses for select to anon, authenticated
  using (status = 'published' or private.is_admin() or private.is_enrolled(id)
         or (instructor_id is not null and instructor_id = private.current_instructor_id()));
create policy courses_insert on public.courses for insert to authenticated
  with check (private.is_admin() or private.current_instructor_id() is not null);
create policy courses_update on public.courses for update to authenticated
  using (private.is_admin() or (instructor_id = private.current_instructor_id() and status in ('draft', 'changes_requested')))
  with check (private.is_admin() or (instructor_id = private.current_instructor_id() and status in ('draft', 'changes_requested')));
create policy courses_delete on public.courses for delete to authenticated
  using (private.is_admin() or (private.owns_course(id) and status = 'draft'));

-- course_modules
create policy modules_select on public.course_modules for select to anon, authenticated
  using (private.course_is_public(course_id) or private.can_view_content(course_id));
create policy modules_write on public.course_modules for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

-- lessons: full rows only for entitled users or free previews of published courses.
create policy lessons_select on public.lessons for select to anon, authenticated
  using (private.can_view_content(course_id) or (is_preview and private.course_is_public(course_id)));
create policy lessons_write on public.lessons for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

-- lesson_resources
create policy resources_select on public.lesson_resources for select to authenticated
  using (private.can_view_content(course_id));
create policy resources_write on public.lesson_resources for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

-- quizzes (metadata visible to entitled users; questions never directly to students)
create policy quizzes_select on public.quizzes for select to authenticated
  using (private.can_view_content(course_id));
create policy quizzes_write on public.quizzes for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

create policy quiz_questions_select on public.quiz_questions for select to authenticated
  using (private.is_admin() or private.owns_course(private.quiz_course(quiz_id)));
create policy quiz_questions_write on public.quiz_questions for all to authenticated
  using (private.can_edit_course(private.quiz_course(quiz_id)))
  with check (private.can_edit_course(private.quiz_course(quiz_id)));

create policy quiz_attempts_select on public.quiz_attempts for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin() or private.owns_course(private.quiz_course(quiz_id)));

-- assignments
create policy assignments_select on public.assignments for select to authenticated
  using (private.can_view_content(course_id));
create policy assignments_write on public.assignments for all to authenticated
  using (private.can_edit_course(course_id)) with check (private.can_edit_course(course_id));

create policy submissions_select on public.assignment_submissions for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin() or private.owns_course(course_id));
create policy submissions_insert on public.assignment_submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted' and feedback is null and reviewed_by is null
    and private.is_enrolled(course_id)
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.course_id = course_id)
  );
create policy submissions_update on public.assignment_submissions for update to authenticated
  using ((user_id = (select auth.uid()) and status <> 'approved' and private.is_enrolled(course_id))
         or private.is_admin() or private.owns_course(course_id))
  with check (user_id = (select auth.uid()) or private.is_admin() or private.owns_course(course_id));

-- enrolments / progress (writes only through definer functions or service role)
create policy enrolments_select on public.enrolments for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin() or private.owns_course(course_id));
create policy enrolments_admin on public.enrolments for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy progress_select on public.lesson_progress for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin() or private.owns_course(course_id));

-- commerce (read-only for owners; writes via service role only)
create policy orders_select on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy payments_select on public.payments for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy refunds_select on public.refunds for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

create policy revenue_shares_select on public.instructor_revenue_shares for select to authenticated
  using (private.is_admin() or instructor_id = private.current_instructor_id());
create policy revenue_shares_admin on public.instructor_revenue_shares for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

create policy earnings_select on public.instructor_earnings for select to authenticated
  using (private.is_admin() or instructor_id = private.current_instructor_id());

create policy payouts_select on public.instructor_payouts for select to authenticated
  using (private.is_admin() or instructor_id = private.current_instructor_id());
create policy payouts_admin on public.instructor_payouts for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- certificates (public verification goes through verify_certificate())
create policy certificates_select on public.certificates for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin() or private.owns_course(course_id));
create policy certificate_verifications_select on public.certificate_verifications for select to authenticated
  using (private.is_admin());

-- reviews
create policy reviews_select on public.reviews for select to anon, authenticated
  using (is_published or user_id = (select auth.uid()) or private.is_admin());
create policy reviews_insert on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()) and private.is_enrolled(course_id) and is_published);
create policy reviews_update on public.reviews for update to authenticated
  using (user_id = (select auth.uid()) or private.is_admin())
  with check (user_id = (select auth.uid()) or private.is_admin());
create policy reviews_delete on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());

-- internships
create policy internships_select on public.internships for select to anon, authenticated
  using (status in ('open', 'closed') or private.is_admin()
         or (employer_id is not null and private.is_employer_member(employer_id)));
create policy internships_admin on public.internships for all to authenticated
  using (private.is_admin()) with check (private.is_admin());
create policy internships_employer_write on public.internships for insert to authenticated
  with check (kind = 'employer' and employer_id is not null and private.is_employer_member(employer_id) and not is_demo);
create policy internships_employer_update on public.internships for update to authenticated
  using (employer_id is not null and private.is_employer_member(employer_id))
  with check (kind = 'employer' and employer_id is not null and private.is_employer_member(employer_id) and not is_demo);

create policy applications_select on public.internship_applications for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin()
         or private.is_employer_member(private.internship_employer(internship_id)));
create policy applications_insert on public.internship_applications for insert to authenticated
  with check (
    user_id = (select auth.uid()) and status = 'submitted'
    and status_note is null and status_updated_by is null
    and private.is_active_user()
    and exists (
      select 1 from public.internships i
      where i.id = internship_id and i.status = 'open'
        and (i.deadline is null or i.deadline >= current_date)
    )
  );

create policy saved_internships_own on public.saved_internships for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- notifications
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- admin-only reads
create policy audit_logs_select on public.audit_logs for select to authenticated using (private.is_admin());
create policy webhook_events_select on public.webhook_events for select to authenticated using (private.is_admin());
create policy email_outbox_select on public.email_outbox for select to authenticated using (private.is_admin());
create policy contact_messages_admin on public.contact_messages for all to authenticated
  using (private.is_admin()) with check (private.is_admin());

-- ---------------------------------------------------------------------------
-- Schema / function privileges for the private helper schema
-- ---------------------------------------------------------------------------
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;
revoke all on all tables in schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public;
grant execute on function
  private.has_role(public.app_role), private.is_admin(), private.is_active_user(), private.is_privileged(),
  private.current_instructor_id(), private.owns_course(uuid), private.is_enrolled(uuid),
  private.can_view_content(uuid), private.can_edit_course(uuid), private.course_is_public(uuid),
  private.is_employer_member(uuid), private.internship_employer(uuid), private.lesson_course(uuid),
  private.quiz_course(uuid),
  private.guard_profiles(), private.guard_instructor_profiles(), private.guard_courses(),
  private.guard_submissions(), private.guard_notifications(), private.set_updated_at()
to anon, authenticated, service_role;

-- ===== supabase/migrations/20261122000003_functions.sql =====
-- =============================================================================
-- SkillSpring — RPC functions
-- All SECURITY DEFINER functions pin search_path and re-check authorization.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function private.notify(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, type, title, body, link) values (p_user, p_type, p_title, p_body, p_link);
$$;

create or replace function private.audit(p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function private.require_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not private.is_active_user() then raise exception 'Account suspended' using errcode = '42501'; end if;
  return uid;
end $$;

create or replace function private.require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := private.require_user();
begin
  if not private.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  return uid;
end $$;

-- ---------------------------------------------------------------------------
-- Pricing & catalogue
-- ---------------------------------------------------------------------------
create or replace function public.course_effective_price(p_course_id uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case
    when c.discount_price_paise is not null and (c.discount_ends_at is null or c.discount_ends_at > now())
      then c.discount_price_paise
    else c.price_paise end
  from public.courses c where c.id = p_course_id;
$$;

-- Server-authoritative purchasability check.
create or replace function public.course_is_purchasable(p_course_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course_id and c.status = 'published' and not c.is_demo
      and c.rights_status in ('owned', 'licensed', 'instructor_owned')
      and exists (select 1 from public.lessons l where l.course_id = c.id)
  );
$$;

create or replace function public.get_course_outline(p_course_id uuid)
returns table (
  module_id uuid, module_title text, module_position int,
  lesson_id uuid, lesson_title text, lesson_type public.lesson_type,
  duration_minutes int, lesson_position int, is_preview boolean, is_mandatory boolean
) language sql stable security definer set search_path = '' as $$
  select m.id, m.title, m.position, l.id, l.title, l.type, l.duration_minutes, l.position, l.is_preview, l.is_mandatory
  from public.course_modules m
  left join public.lessons l on l.module_id = m.id
  where m.course_id = p_course_id
    and (private.course_is_public(p_course_id) or private.can_view_content(p_course_id))
  order by m.position, m.created_at, l.position, l.created_at;
$$;

create or replace function public.course_review_stats()
returns table (course_id uuid, review_count int, avg_rating numeric)
language sql stable security definer set search_path = '' as $$
  select r.course_id, count(*)::int, round(avg(r.rating)::numeric, 1)
  from public.reviews r join public.courses c on c.id = r.course_id
  where r.is_published and c.status = 'published'
  group by r.course_id;
$$;

create or replace function public.course_enrolment_counts()
returns table (course_id uuid, enrolment_count int)
language sql stable security definer set search_path = '' as $$
  select e.course_id, count(*)::int from public.enrolments e
  join public.courses c on c.id = e.course_id
  where e.status = 'active' and c.status = 'published'
  group by e.course_id;
$$;

-- ---------------------------------------------------------------------------
-- Enrolment (free courses). Paid enrolments only via fulfil_order().
-- ---------------------------------------------------------------------------
create or replace function public.enrol_free_course(p_course_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); eid uuid;
begin
  if not public.course_is_purchasable(p_course_id) then
    raise exception 'Course is not available for enrolment' using errcode = 'P0001';
  end if;
  if public.course_effective_price(p_course_id) <> 0 then
    raise exception 'This course is not free' using errcode = 'P0001';
  end if;
  insert into public.enrolments (user_id, course_id, source, status)
  values (uid, p_course_id, 'free', 'active')
  on conflict (user_id, course_id) do update set status = 'active'
    where public.enrolments.status <> 'revoked'
  returning id into eid;
  if eid is null then raise exception 'Enrolment revoked by an administrator' using errcode = '42501'; end if;
  return eid;
end $$;

-- ---------------------------------------------------------------------------
-- Payments (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.fulfil_order(
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_signature text,
  p_amount_paise int,
  p_method text,
  p_verified_via text,
  p_raw jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.orders%rowtype;
  c public.courses%rowtype;
  eid uuid;
  newly boolean := false;
  share numeric(5,2);
begin
  select * into o from public.orders where razorpay_order_id = p_razorpay_order_id for update;
  if not found then raise exception 'Unknown order %', p_razorpay_order_id using errcode = 'P0002'; end if;
  if p_amount_paise <> o.amount_paise then
    raise exception 'Amount mismatch for order % (expected %, got %)', o.id, o.amount_paise, p_amount_paise using errcode = 'P0001';
  end if;

  insert into public.payments (order_id, user_id, razorpay_payment_id, razorpay_signature, amount_paise, status, method, verified_via, raw)
  values (o.id, o.user_id, p_razorpay_payment_id, p_signature, p_amount_paise, 'captured', p_method, p_verified_via, p_raw)
  on conflict (razorpay_payment_id) do update
    set status = case when public.payments.status in ('refunded', 'partially_refunded') then public.payments.status else 'captured' end,
        razorpay_signature = coalesce(public.payments.razorpay_signature, excluded.razorpay_signature),
        method = coalesce(excluded.method, public.payments.method);

  if o.status = 'paid' or o.status in ('refunded', 'partially_refunded') then
    select id into eid from public.enrolments where user_id = o.user_id and course_id = o.course_id;
    return jsonb_build_object('enrolment_id', eid, 'newly_enrolled', false, 'user_id', o.user_id, 'course_id', o.course_id, 'order_id', o.id);
  end if;

  update public.orders set status = 'paid', paid_at = now() where id = o.id;

  insert into public.enrolments (user_id, course_id, order_id, source, status)
  values (o.user_id, o.course_id, o.id, 'purchase', 'active')
  on conflict (user_id, course_id) do update
    set status = 'active', order_id = excluded.order_id, source = 'purchase'
    where public.enrolments.status <> 'active'
  returning id into eid;
  if eid is not null then newly := true;
  else select id into eid from public.enrolments where user_id = o.user_id and course_id = o.course_id;
  end if;

  select * into c from public.courses where id = o.course_id;
  if c.instructor_id is not null then
    select rs.share_pct into share from public.instructor_revenue_shares rs
    where rs.instructor_id = c.instructor_id and (rs.course_id = c.id or rs.course_id is null)
      and rs.effective_from <= now() and (rs.effective_to is null or rs.effective_to > now())
    order by (rs.course_id is null), rs.effective_from desc limit 1;
    if share is null then
      select default_revenue_share_pct into share from public.instructor_profiles where id = c.instructor_id;
    end if;
    if coalesce(share, 0) > 0 then
      insert into public.instructor_earnings (instructor_id, course_id, order_id, gross_paise, share_pct, amount_paise)
      values (c.instructor_id, c.id, o.id, o.amount_paise, share, floor(o.amount_paise * share / 100))
      on conflict do nothing;
    end if;
  end if;

  if newly then
    perform private.notify(o.user_id, 'enrolment', 'You are enrolled in ' || c.title,
      'Your payment was verified. Start learning whenever you are ready.', '/dashboard/learning/' || c.slug);
  end if;
  perform private.audit(o.user_id, 'payment.captured', 'order', o.id::text,
    jsonb_build_object('payment_id', p_razorpay_payment_id, 'amount_paise', p_amount_paise, 'via', p_verified_via));

  return jsonb_build_object('enrolment_id', eid, 'newly_enrolled', newly, 'user_id', o.user_id, 'course_id', o.course_id, 'order_id', o.id);
end $$;

create or replace function public.mark_order_failed(
  p_razorpay_order_id text, p_razorpay_payment_id text, p_error_code text, p_error_description text, p_raw jsonb
) returns void language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where razorpay_order_id = p_razorpay_order_id for update;
  if not found then return; end if;
  if p_razorpay_payment_id is not null then
    insert into public.payments (order_id, user_id, razorpay_payment_id, amount_paise, status, error_code, error_description, verified_via, raw)
    values (o.id, o.user_id, p_razorpay_payment_id, o.amount_paise, 'failed', p_error_code, left(p_error_description, 500), 'webhook', p_raw)
    on conflict (razorpay_payment_id) do update
      set status = case when public.payments.status = 'captured' then public.payments.status else 'failed' end,
          error_code = excluded.error_code, error_description = excluded.error_description;
  end if;
  -- Never downgrade a paid order: a later failed attempt does not undo a capture.
  if o.status in ('created', 'attempted') then
    update public.orders set status = 'failed' where id = o.id;
  end if;
end $$;

create or replace function public.mark_order_attempted(p_razorpay_order_id text)
returns void language sql security definer set search_path = '' as $$
  update public.orders set status = 'attempted' where razorpay_order_id = p_razorpay_order_id and status = 'created';
$$;

create or replace function public.apply_refund(
  p_razorpay_payment_id text, p_razorpay_refund_id text, p_amount_paise int,
  p_status public.refund_status, p_reason text, p_requested_by uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  pay public.payments%rowtype; o public.orders%rowtype; rid uuid; refunded_total int; prior public.refund_status;
begin
  select * into pay from public.payments where razorpay_payment_id = p_razorpay_payment_id for update;
  if not found then raise exception 'Unknown payment %', p_razorpay_payment_id using errcode = 'P0002'; end if;
  select * into o from public.orders where id = pay.order_id for update;

  select status into prior from public.refunds where razorpay_refund_id = p_razorpay_refund_id;

  insert into public.refunds (payment_id, order_id, user_id, razorpay_refund_id, amount_paise, reason, status, requested_by, processed_at)
  values (pay.id, o.id, o.user_id, p_razorpay_refund_id, p_amount_paise, p_reason, p_status, p_requested_by,
          case when p_status = 'processed' then now() end)
  on conflict (razorpay_refund_id) do update
    set status = excluded.status,
        processed_at = coalesce(public.refunds.processed_at, excluded.processed_at)
  returning id into rid;

  if p_status = 'processed' and prior is distinct from 'processed' then
    select coalesce(sum(amount_paise), 0) into refunded_total from public.refunds where payment_id = pay.id and status = 'processed';
    if refunded_total >= pay.amount_paise then
      update public.payments set status = 'refunded' where id = pay.id;
      update public.orders set status = 'refunded' where id = o.id;
      update public.enrolments set status = 'refunded' where user_id = o.user_id and course_id = o.course_id and order_id = o.id;
    else
      update public.payments set status = 'partially_refunded' where id = pay.id;
      update public.orders set status = 'partially_refunded' where id = o.id;
    end if;
    -- Reverse the instructor's share proportionally.
    insert into public.instructor_earnings (instructor_id, course_id, order_id, refund_id, gross_paise, share_pct, amount_paise)
    select e.instructor_id, e.course_id, e.order_id, rid, -p_amount_paise, e.share_pct, -floor(p_amount_paise * e.share_pct / 100)
    from public.instructor_earnings e where e.order_id = o.id and e.refund_id is null
    on conflict do nothing;
    perform private.notify(o.user_id, 'refund', 'Refund processed',
      'A refund of ₹' || to_char(p_amount_paise / 100.0, 'FM999999990.00') || ' has been processed.', '/dashboard/payments');
  end if;
  perform private.audit(p_requested_by, 'refund.' || p_status::text, 'refund', rid::text,
    jsonb_build_object('payment_id', p_razorpay_payment_id, 'amount_paise', p_amount_paise));
  return rid;
end $$;

create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = '' as $$
declare r private.rate_limits%rowtype;
begin
  insert into private.rate_limits as rl (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1 else rl.count + 1 end,
    window_start = case when rl.window_start < now() - make_interval(secs => p_window_seconds) then now() else rl.window_start end
  returning * into r;
  return r.count <= p_max;
end $$;

create or replace function public.log_audit(p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb)
returns void language sql security definer set search_path = '' as $$
  select private.audit(p_actor, p_action, p_entity_type, p_entity_id, p_metadata);
$$;

create or replace function public.create_notification(p_user uuid, p_type text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  select private.notify(p_user, p_type, p_title, p_body, p_link);
$$;

-- ---------------------------------------------------------------------------
-- Learning progress
-- ---------------------------------------------------------------------------
create or replace function public.get_course_progress(p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); total int; done int; mand int; mand_done int;
begin
  if uid is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  select count(*), count(*) filter (where l.is_mandatory) into total, mand from public.lessons l where l.course_id = p_course_id;
  select count(*), count(*) filter (where l.is_mandatory) into done, mand_done
  from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
  where lp.user_id = uid and lp.course_id = p_course_id and lp.completed_at is not null;
  return jsonb_build_object(
    'total', total, 'completed', done, 'mandatory_total', mand, 'mandatory_completed', mand_done,
    'percent', case when total = 0 then 0 else round(done * 100.0 / total)::int end
  );
end $$;

create or replace function public.touch_lesson(p_lesson_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); cid uuid := private.lesson_course(p_lesson_id);
begin
  if cid is null or not private.is_enrolled(cid) then
    raise exception 'Not enrolled in this course' using errcode = '42501';
  end if;
  update public.enrolments set last_lesson_id = p_lesson_id, last_accessed_at = now()
  where user_id = uid and course_id = cid;
  insert into public.lesson_progress (user_id, lesson_id, course_id) values (uid, p_lesson_id, cid)
  on conflict (user_id, lesson_id) do update set updated_at = now();
end $$;

create or replace function public.complete_lesson(p_lesson_id uuid, p_completed boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); cid uuid := private.lesson_course(p_lesson_id);
begin
  if cid is null or not private.is_enrolled(cid) then
    raise exception 'Not enrolled in this course' using errcode = '42501';
  end if;
  insert into public.lesson_progress (user_id, lesson_id, course_id, completed_at)
  values (uid, p_lesson_id, cid, case when p_completed then now() end)
  on conflict (user_id, lesson_id) do update
    set completed_at = case when p_completed then coalesce(public.lesson_progress.completed_at, now()) else null end;
  update public.enrolments set last_lesson_id = p_lesson_id, last_accessed_at = now()
  where user_id = uid and course_id = cid;
  return public.get_course_progress(cid);
end $$;

-- ---------------------------------------------------------------------------
-- Quizzes (answers never leave the database before grading)
-- ---------------------------------------------------------------------------
create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.quizzes%rowtype; uid uuid := (select auth.uid()); used int; best int;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if not found or not private.can_view_content(q.course_id) then
    raise exception 'Quiz not available' using errcode = '42501';
  end if;
  select count(*), max(score_pct) into used, best from public.quiz_attempts where quiz_id = q.id and user_id = uid;
  return jsonb_build_object(
    'id', q.id, 'title', q.title, 'description', q.description, 'pass_pct', q.pass_pct,
    'max_attempts', q.max_attempts, 'attempts_used', used, 'best_score', best,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object('id', qq.id, 'prompt', qq.prompt, 'options', qq.options) order by qq.position, qq.created_at)
      from public.quiz_questions qq where qq.quiz_id = q.id), '[]'::jsonb)
  );
end $$;

create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user(); q public.quizzes%rowtype; used int; total int; correct int; pct int; passed boolean; results jsonb;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if not found or not private.is_enrolled(q.course_id) then
    raise exception 'Not enrolled in this course' using errcode = '42501';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Invalid answers' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text || q.id::text));
  select count(*) into used from public.quiz_attempts where quiz_id = q.id and user_id = uid;
  if q.max_attempts is not null and used >= q.max_attempts then
    raise exception 'No attempts remaining' using errcode = 'P0001';
  end if;
  select count(*),
         count(*) filter (where (p_answers ->> qq.id::text) ~ '^\d+$' and (p_answers ->> qq.id::text)::int = qq.correct_index),
         jsonb_agg(jsonb_build_object(
           'question_id', qq.id,
           'correct', (p_answers ->> qq.id::text) ~ '^\d+$' and (p_answers ->> qq.id::text)::int = qq.correct_index,
           'explanation', qq.explanation))
    into total, correct, results
  from public.quiz_questions qq where qq.quiz_id = q.id;
  if total = 0 then raise exception 'Quiz has no questions' using errcode = 'P0001'; end if;
  pct := round(correct * 100.0 / total);
  passed := pct >= q.pass_pct;
  insert into public.quiz_attempts (quiz_id, user_id, answers, score_pct, passed) values (q.id, uid, p_answers, pct, passed);
  return jsonb_build_object('score_pct', pct, 'passed', passed, 'correct', correct, 'total', total, 'results', results);
end $$;

-- ---------------------------------------------------------------------------
-- Completion & certificates
-- ---------------------------------------------------------------------------
create or replace function private.completion_status(p_user uuid, p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.courses%rowtype; lessons_total int; lessons_done int; lessons_ok boolean;
  asg_total int; asg_done int; asg_ok boolean; quiz_total int; quiz_passed int; quiz_ok boolean;
begin
  select * into c from public.courses where id = p_course_id;
  select count(*) into lessons_total from public.lessons where course_id = c.id and is_mandatory;
  select count(*) into lessons_done from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = p_user and l.course_id = c.id and l.is_mandatory and lp.completed_at is not null;
  lessons_ok := (select count(*) from public.lessons where course_id = c.id) > 0
                and (not c.completion_requires_all_lessons or lessons_done >= lessons_total);

  select count(*) into asg_total from public.assignments where course_id = c.id and is_mandatory;
  select count(*) into asg_done from public.assignments a
    join public.assignment_submissions s on s.assignment_id = a.id and s.user_id = p_user
    where a.course_id = c.id and a.is_mandatory and s.status in ('submitted', 'approved');
  asg_ok := not c.completion_requires_assignments or asg_done >= asg_total;

  select count(*) into quiz_total from public.quizzes where course_id = c.id and is_mandatory;
  select count(*) into quiz_passed from public.quizzes qz
    where qz.course_id = c.id and qz.is_mandatory and exists (
      select 1 from public.quiz_attempts qa where qa.quiz_id = qz.id and qa.user_id = p_user
        and qa.score_pct >= greatest(qz.pass_pct, coalesce(c.completion_min_quiz_pct, 0)));
  quiz_ok := quiz_passed >= quiz_total;

  return jsonb_build_object(
    'eligible', lessons_ok and asg_ok and quiz_ok,
    'lessons', jsonb_build_object('ok', lessons_ok, 'done', lessons_done, 'required', lessons_total),
    'assignments', jsonb_build_object('ok', asg_ok, 'done', asg_done, 'required', asg_total),
    'quizzes', jsonb_build_object('ok', quiz_ok, 'passed', quiz_passed, 'required', quiz_total,
                                  'min_pct', c.completion_min_quiz_pct)
  );
end $$;

create or replace function public.get_completion_status(p_course_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null or not private.is_enrolled(p_course_id) then
    raise exception 'Not enrolled in this course' using errcode = '42501';
  end if;
  return private.completion_status(uid, p_course_id);
end $$;

create or replace function public.issue_certificate(p_course_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user(); st jsonb; e public.enrolments%rowtype; cert public.certificates%rowtype;
  p public.profiles%rowtype; c public.courses%rowtype; code text;
begin
  select * into e from public.enrolments where user_id = uid and course_id = p_course_id and status = 'active';
  if not found then raise exception 'Not enrolled in this course' using errcode = '42501'; end if;

  select * into cert from public.certificates where user_id = uid and course_id = p_course_id;
  if found then
    return jsonb_build_object('certificate_code', cert.certificate_code, 'status', cert.status, 'new', false);
  end if;

  st := private.completion_status(uid, p_course_id);
  if not (st ->> 'eligible')::boolean then
    raise exception 'Course completion requirements not met' using errcode = 'P0001', detail = st::text;
  end if;

  select * into p from public.profiles where id = uid;
  if coalesce(trim(p.full_name), '') = '' then
    raise exception 'Add your full name to your profile before claiming a certificate' using errcode = 'P0001';
  end if;
  select * into c from public.courses where id = p_course_id;

  loop
    code := 'SS-' || to_char(now(), 'YYYY') || '-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (select 1 from public.certificates where certificate_code = code);
  end loop;

  insert into public.certificates (certificate_code, user_id, course_id, enrolment_id, student_name, course_title)
  values (code, uid, p_course_id, e.id, trim(p.full_name), c.title)
  returning * into cert;
  update public.enrolments set completed_at = coalesce(completed_at, now()) where id = e.id;
  perform private.notify(uid, 'certificate', 'Certificate issued: ' || c.title,
    'Congratulations! Your certificate ID is ' || code || '.', '/dashboard/certificates');
  perform private.audit(uid, 'certificate.issued', 'certificate', cert.id::text, jsonb_build_object('code', code));
  return jsonb_build_object('certificate_code', code, 'status', 'valid', 'new', true);
end $$;

create or replace function public.verify_certificate(p_code text)
returns table (certificate_code text, student_name text, course_title text, issued_at timestamptz,
               status public.certificate_status, revoked_at timestamptz, issuer text)
language plpgsql security definer set search_path = '' as $$
declare cert public.certificates%rowtype; normalized text := upper(trim(coalesce(p_code, '')));
begin
  if char_length(normalized) > 40 or normalized !~ '^[A-Z0-9\-]+$' then
    return;
  end if;
  select * into cert from public.certificates c where c.certificate_code = normalized;
  insert into public.certificate_verifications (certificate_id, code_queried, found)
  values (cert.id, normalized, cert.id is not null);
  if cert.id is null then return; end if;
  return query select cert.certificate_code, cert.student_name, cert.course_title, cert.issued_at, cert.status, cert.revoked_at, 'SkillSpring'::text;
end $$;

create or replace function public.admin_revoke_certificate(p_certificate_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); cert public.certificates%rowtype;
begin
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required' using errcode = '22023'; end if;
  update public.certificates set status = 'revoked', revoked_at = now(), revoked_reason = p_reason, revoked_by = uid
  where id = p_certificate_id and status = 'valid' returning * into cert;
  if not found then raise exception 'Certificate not found or already revoked' using errcode = 'P0002'; end if;
  perform private.notify(cert.user_id, 'certificate', 'Certificate revoked', 'Certificate ' || cert.certificate_code || ' was revoked: ' || p_reason, '/dashboard/certificates');
  perform private.audit(uid, 'certificate.revoked', 'certificate', cert.id::text, jsonb_build_object('reason', p_reason));
end $$;

-- ---------------------------------------------------------------------------
-- Course review workflow
-- ---------------------------------------------------------------------------
create or replace function public.submit_course_for_review(p_course_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); c public.courses%rowtype;
begin
  select * into c from public.courses where id = p_course_id for update;
  if not found or not (private.owns_course(c.id) or private.is_admin()) then
    raise exception 'Course not found' using errcode = '42501';
  end if;
  if c.status not in ('draft', 'changes_requested') then
    raise exception 'Only draft courses can be submitted' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.lessons where course_id = c.id) then
    raise exception 'Add at least one module and lesson before submitting' using errcode = 'P0001';
  end if;
  update public.courses set status = 'pending_review', submitted_at = now() where id = c.id;
  perform private.audit(uid, 'course.submitted', 'course', c.id::text, '{}'::jsonb);
end $$;

create or replace function public.admin_review_course(p_course_id uuid, p_decision text, p_notes text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); c public.courses%rowtype; new_status public.course_status; owner uuid;
begin
  select * into c from public.courses where id = p_course_id for update;
  if not found then raise exception 'Course not found' using errcode = 'P0002'; end if;
  new_status := case p_decision
    when 'approve' then 'approved'::public.course_status
    when 'request_changes' then 'changes_requested'::public.course_status
    when 'archive' then 'archived'::public.course_status
    else null end;
  if new_status is null then raise exception 'Invalid decision' using errcode = '22023'; end if;
  if p_decision in ('approve', 'request_changes') and c.status not in ('pending_review', 'draft', 'changes_requested') then
    raise exception 'Course is not awaiting review' using errcode = 'P0001';
  end if;
  update public.courses set status = new_status, reviewed_by = uid, reviewed_at = now(), review_notes = p_notes
  where id = c.id;
  select ip.user_id into owner from public.instructor_profiles ip where ip.id = c.instructor_id;
  if owner is not null then
    perform private.notify(owner, 'course_review', 'Course review: ' || c.title,
      case p_decision when 'approve' then 'Your course was approved.' when 'archive' then 'Your course was archived.'
        else 'Changes were requested: ' || coalesce(p_notes, '') end, '/instructor/courses/' || c.id);
  end if;
  perform private.audit(uid, 'course.review.' || p_decision, 'course', c.id::text, jsonb_build_object('notes', p_notes));
end $$;

create or replace function public.admin_publish_course(p_course_id uuid, p_publish boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_admin(); c public.courses%rowtype;
begin
  select * into c from public.courses where id = p_course_id for update;
  if not found then raise exception 'Course not found' using errcode = 'P0002'; end if;
  if p_publish then
    if c.status not in ('approved', 'published') then
      raise exception 'Course must be approved before publishing' using errcode = 'P0001';
    end if;
    if c.rights_status = 'rejected' then
      raise exception 'Content rights were rejected; course cannot be published' using errcode = 'P0001';
    end if;
    update public.courses set status = 'published', published_at = coalesce(published_at, now()) where id = c.id;
  else
    if c.status <> 'published' then raise exception 'Course is not published' using errcode = 'P0001'; end if;
    update public.courses set status = 'approved' where id = c.id;
  end if;
  perform private.audit(uid, case when p_publish then 'course.published' else 'course.unpublished' end, 'course', c.id::text, '{}'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- Internship applications
-- ---------------------------------------------------------------------------
create or replace function public.update_application_status(p_application_id uuid, p_status public.application_status, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); a public.internship_applications%rowtype; i public.internships%rowtype;
begin
  select * into a from public.internship_applications where id = p_application_id for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  select * into i from public.internships where id = a.internship_id;
  if not (private.is_admin() or (i.employer_id is not null and private.is_employer_member(i.employer_id))) then
    raise exception 'Not allowed to update this application' using errcode = '42501';
  end if;
  if p_status = 'withdrawn' then raise exception 'Only the applicant can withdraw' using errcode = 'P0001'; end if;
  if a.status = 'withdrawn' then raise exception 'Application was withdrawn by the applicant' using errcode = 'P0001'; end if;
  update public.internship_applications
  set status = p_status, status_note = p_note, status_updated_by = uid, status_updated_at = now()
  where id = a.id;
  perform private.notify(a.user_id, 'application', 'Application update: ' || i.title,
    'Your application status is now: ' || replace(p_status::text, '_', ' ') || '.', '/dashboard/applications');
  perform private.audit(uid, 'application.status', 'internship_application', a.id::text,
    jsonb_build_object('from', a.status, 'to', p_status, 'note', p_note));
end $$;

create or replace function public.withdraw_application(p_application_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := private.require_user(); a public.internship_applications%rowtype;
begin
  select * into a from public.internship_applications where id = p_application_id and user_id = uid for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;
  if a.status in ('selected', 'rejected', 'withdrawn') then
    raise exception 'This application can no longer be withdrawn' using errcode = 'P0001';
  end if;
  update public.internship_applications set status = 'withdrawn', status_updated_by = uid, status_updated_at = now() where id = a.id;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create or replace function public.mark_all_notifications_read()
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now() where user_id = (select auth.uid()) and read_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Admin reporting
-- ---------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'students', (select count(*) from public.user_roles where role = 'student'),
    'paid_enrolments', (select count(*) from public.enrolments where source = 'purchase' and status = 'active'),
    'courses', (select count(*) from public.courses where status <> 'archived'),
    'published_courses', (select count(*) from public.courses where status = 'published'),
    'pending_course_reviews', (select count(*) from public.courses where status = 'pending_review'),
    'revenue_paise', (select coalesce(sum(amount_paise), 0) from public.payments where status in ('captured', 'partially_refunded', 'refunded')),
    'refunds_paise', (select coalesce(sum(amount_paise), 0) from public.refunds where status = 'processed'),
    'pending_applications', (select count(*) from public.internship_applications where status in ('submitted', 'under_review')),
    'pending_instructors', (select count(*) from public.instructor_profiles where status = 'pending')
  );
end $$;

create or replace function public.admin_course_revenue()
returns table (course_id uuid, title text, sales int, gross_paise bigint, refunds_paise bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select c.id, c.title,
    (select count(*)::int from public.orders o where o.course_id = c.id and o.status in ('paid', 'partially_refunded', 'refunded')),
    (select coalesce(sum(p.amount_paise), 0)::bigint from public.payments p join public.orders o on o.id = p.order_id
       where o.course_id = c.id and p.status in ('captured', 'partially_refunded', 'refunded')),
    (select coalesce(sum(r.amount_paise), 0)::bigint from public.refunds r join public.orders o on o.id = r.order_id
       where o.course_id = c.id and r.status = 'processed')
  from public.courses c order by 4 desc, c.title;
end $$;

create or replace function public.instructor_course_stats()
returns table (course_id uuid, title text, status public.course_status, enrolments int, completions int, earnings_paise bigint)
language plpgsql stable security definer set search_path = '' as $$
declare iid uuid := private.current_instructor_id();
begin
  if iid is null then raise exception 'Approved instructor access required' using errcode = '42501'; end if;
  return query
  select c.id, c.title, c.status,
    (select count(*)::int from public.enrolments e where e.course_id = c.id and e.status = 'active'),
    (select count(*)::int from public.certificates ce where ce.course_id = c.id and ce.status = 'valid'),
    (select coalesce(sum(ie.amount_paise), 0)::bigint from public.instructor_earnings ie where ie.course_id = c.id and ie.instructor_id = iid)
  from public.courses c where c.instructor_id = iid order by c.created_at desc;
end $$;

-- ---------------------------------------------------------------------------
-- Function privileges: revoke the platform defaults, then grant explicitly.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public;
do $$ begin
  execute 'revoke execute on all functions in schema public from anon, authenticated';
exception when undefined_object then null; end $$;
revoke execute on all functions in schema private from public;

grant execute on function private.notify(uuid, text, text, text, text), private.audit(uuid, text, text, text, jsonb),
  private.require_user(), private.require_admin(), private.completion_status(uuid, uuid), private.sync_lesson_course(),
  private.sync_resource_course(), private.handle_new_user(), private.handle_user_email_change()
  to service_role;

-- Public (anon + authenticated)
grant execute on function public.course_effective_price(uuid), public.course_is_purchasable(uuid),
  public.get_course_outline(uuid), public.course_review_stats(), public.course_enrolment_counts(),
  public.verify_certificate(text)
  to anon, authenticated, service_role;

-- Signed-in users (each function re-checks role/ownership internally)
grant execute on function public.enrol_free_course(uuid), public.get_course_progress(uuid), public.touch_lesson(uuid),
  public.complete_lesson(uuid, boolean), public.get_quiz(uuid), public.submit_quiz_attempt(uuid, jsonb),
  public.get_completion_status(uuid), public.issue_certificate(uuid), public.admin_revoke_certificate(uuid, text),
  public.submit_course_for_review(uuid), public.admin_review_course(uuid, text, text), public.admin_publish_course(uuid, boolean),
  public.update_application_status(uuid, public.application_status, text), public.withdraw_application(uuid),
  public.mark_all_notifications_read(), public.admin_overview(), public.admin_course_revenue(), public.instructor_course_stats()
  to authenticated, service_role;

-- Server only (service role key never reaches the browser)
grant execute on function public.fulfil_order(text, text, text, int, text, text, jsonb),
  public.mark_order_failed(text, text, text, text, jsonb), public.mark_order_attempted(text),
  public.apply_refund(text, text, int, public.refund_status, text, uuid),
  public.check_rate_limit(text, int, int), public.log_audit(uuid, text, text, text, jsonb),
  public.create_notification(uuid, text, text, text, text)
  to service_role;

-- Make sure future functions are not executable by default.
alter default privileges in schema public revoke execute on functions from public;

-- ===== supabase/migrations/20261122000004_storage.sql =====
-- =============================================================================
-- SkillSpring — Supabase Storage buckets and object policies
-- Object path convention: <owner-or-course-id>/<random-uuid>.<ext>
-- Private buckets are only ever served through short-lived signed URLs
-- generated server-side after an authorization check.
-- =============================================================================

create or replace function private.try_uuid(p text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p::uuid;
exception when others then
  return null;
end $$;
grant execute on function private.try_uuid(text) to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('course-thumbnails', 'course-thumbnails', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('course-resources', 'course-resources', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'application/zip',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('assignment-submissions', 'assignment-submissions', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'application/zip',
     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('resumes', 'resumes', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Avatars: users manage files inside their own folder; public read via public bucket URL.
create policy "avatars_own_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_own_update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Course thumbnails: admins, or approved instructors for their editable course folder.
create policy "thumbnails_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-thumbnails' and (
    private.is_admin() or private.can_edit_course(private.try_uuid((storage.foldername(name))[1]))));

-- Course resources: write by editors; read by entitled users (normally via signed URL).
create policy "resources_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-resources' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
create policy "resources_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-resources' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
create policy "resources_read" on storage.objects for select to authenticated
  using (bucket_id = 'course-resources' and private.can_view_content(private.try_uuid((storage.foldername(name))[1])));

-- Assignment submissions: <user-id>/<course-id>/<file>
create policy "submissions_own_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.is_enrolled(private.try_uuid((storage.foldername(name))[2])));
create policy "submissions_read" on storage.objects for select to authenticated
  using (bucket_id = 'assignment-submissions' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.is_admin()
    or private.owns_course(private.try_uuid((storage.foldername(name))[2]))));

-- Resumes: <user-id>/<file>. Employers/admins receive signed URLs from the server.
create policy "resumes_own_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "resumes_read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and ((storage.foldername(name))[1] = (select auth.uid())::text or private.is_admin()));

-- ===== supabase/seed.sql =====
-- GENERATED by scripts/generate-seed.ts — do not edit by hand.
-- All courses are DEMO / NOT YET AVAILABLE FOR PURCHASE (is_demo = true, rights_status = 'pending').
begin;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('83d44631-083f-54d8-ab12-958f6bd76090', 'finance-stock-market', 'Finance & Stock Market', 'Markets, analysis and financial modelling.', 'trending-up', 1) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('d324a41c-9835-56c7-acc2-457b57e7fa18', 'technology-ai', 'Technology & AI', 'Generative AI, prompting and data skills.', 'cpu', 2) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('6326dcf3-9542-5956-a662-5a204acdcf36', 'business-marketing', 'Business & Marketing', 'Digital, content and social media marketing.', 'megaphone', 3) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('22b6698c-4bfd-551c-a099-3ec5a8b13816', 'career-development', 'Career Development', 'Resumes, interviews and workplace communication.', 'briefcase', 4) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('bab4b0b5-5182-54e5-a018-b7a413c23902', 'stock-market-fundamentals', 'Stock Market Fundamentals', 'How Indian equity markets work, from exchanges to order types.', 'A structured introduction to the Indian stock market: how NSE and BSE work, the role of SEBI, depositories and brokers, how prices are formed and how to read basic market data responsibly.', (select id from public.categories where slug = 'finance-stock-market'), '/thumbnails/stock-market-fundamentals.svg', 49900, 'beginner', 'English', 120, array['Explain how exchanges, brokers and depositories fit together', 'Read a stock quote and an order book', 'Tell investing apart from trading and speculation', 'Recognise common risks and investor-protection rules']::text[], array['No prior finance knowledge needed']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('23fe5b68-ee6f-5980-aa6f-f3f61e33aecd', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Market structure', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('a8a2bb98-82bb-5617-a4f0-1298bad7270a', '23fe5b68-ee6f-5980-aa6f-f3f61e33aecd', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'What a stock market is for', 'video', '> **Demo lesson.** The full content for "What a stock market is for" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8cf69d37-d5cd-51b1-aeac-c72f597b6f4d', '23fe5b68-ee6f-5980-aa6f-f3f61e33aecd', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Exchanges, brokers and depositories', 'video', '> **Demo lesson.** The full content for "Exchanges, brokers and depositories" will be published once course material and instructor rights are approved.', 15, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b3da0d00-702a-5f28-a7fb-9231b8440334', '23fe5b68-ee6f-5980-aa6f-f3f61e33aecd', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Regulation and investor protection', 'text', '> **Demo lesson.** The full content for "Regulation and investor protection" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('bb326d6d-eecf-5473-a139-bd05ef3e9fbb', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Prices and orders', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('0f308ca9-5169-511b-a73e-154842b2c8ca', 'bb326d6d-eecf-5473-a139-bd05ef3e9fbb', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'How prices are discovered', 'video', '> **Demo lesson.** The full content for "How prices are discovered" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('c4682180-9a1f-5e64-a720-d2a43ba00dfb', 'bb326d6d-eecf-5473-a139-bd05ef3e9fbb', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Order types explained', 'video', '> **Demo lesson.** The full content for "Order types explained" will be published once course material and instructor rights are approved.', 13, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('1da64fff-49fe-5e2e-afb0-8930974824ac', 'bb326d6d-eecf-5473-a139-bd05ef3e9fbb', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Module quiz', 'quiz', '> **Demo lesson.** The full content for "Module quiz" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('813a7c2a-268f-575d-afda-18ebfb6ca6f9', 'bab4b0b5-5182-54e5-a018-b7a413c23902', '1da64fff-49fe-5e2e-afb0-8930974824ac', 'Module quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('dd99f680-34a0-5278-ac88-0f4dbe21b895', '813a7c2a-268f-575d-afda-18ebfb6ca6f9', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('b88b8c40-4280-5215-a2d4-e960e3124f1a', '813a7c2a-268f-575d-afda-18ebfb6ca6f9', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('32b1bf90-87df-5a0e-a55f-9db0bb0487b4', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Getting started responsibly', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b1a57e13-3c42-5389-a233-d044b03614dd', '32b1bf90-87df-5a0e-a55f-9db0bb0487b4', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Risk, diversification and time horizon', 'video', '> **Demo lesson.** The full content for "Risk, diversification and time horizon" will be published once course material and instructor rights are approved.', 16, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('802e6bbd-f14c-5128-a329-414f85e78687', '32b1bf90-87df-5a0e-a55f-9db0bb0487b4', 'bab4b0b5-5182-54e5-a018-b7a413c23902', 'Assignment: build a watchlist with a rationale', 'assignment', '> **Demo lesson.** The full content for "Assignment: build a watchlist with a rationale" will be published once course material and instructor rights are approved.', 30, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('853896a6-88a7-54ec-aae5-ef776e100c9a', 'bab4b0b5-5182-54e5-a018-b7a413c23902', '802e6bbd-f14c-5128-a329-414f85e78687', 'build a watchlist with a rationale', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'technical-analysis-for-beginners', 'Technical Analysis for Beginners', 'Charts, trends, support and resistance, and the limits of indicators.', 'Learn to read price charts and common indicators, understand what technical analysis can and cannot tell you, and practise disciplined risk management.', (select id from public.categories where slug = 'finance-stock-market'), '/thumbnails/technical-analysis-for-beginners.svg', 79900, 'beginner', 'English', 127, array['Read candlestick charts', 'Identify trends, support and resistance', 'Use moving averages, RSI and volume with caution', 'Write a basic trading-journal entry with risk limits']::text[], array['Stock Market Fundamentals or equivalent knowledge']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('317523d5-f267-57cc-a05a-54cda97574a2', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Reading charts', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('35213abe-18a9-53e2-a746-22b93fdbb0dd', '317523d5-f267-57cc-a05a-54cda97574a2', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Candlesticks and timeframes', 'video', '> **Demo lesson.** The full content for "Candlesticks and timeframes" will be published once course material and instructor rights are approved.', 14, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('149df9af-7885-52bf-adda-26f8c7228a53', '317523d5-f267-57cc-a05a-54cda97574a2', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Trends and trendlines', 'video', '> **Demo lesson.** The full content for "Trends and trendlines" will be published once course material and instructor rights are approved.', 15, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('172618f3-783e-52e3-acc3-64d759bfca8f', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Indicators', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('fda82eea-91b6-5193-ad6d-44be0934b6ed', '172618f3-783e-52e3-acc3-64d759bfca8f', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Moving averages', 'video', '> **Demo lesson.** The full content for "Moving averages" will be published once course material and instructor rights are approved.', 12, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('51f806e6-9b27-50d1-a6cc-563b8c9bbaa8', '172618f3-783e-52e3-acc3-64d759bfca8f', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'RSI and momentum', 'video', '> **Demo lesson.** The full content for "RSI and momentum" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('46b0d027-1836-5030-ad4a-b38fb35803f6', '172618f3-783e-52e3-acc3-64d759bfca8f', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Volume', 'text', '> **Demo lesson.** The full content for "Volume" will be published once course material and instructor rights are approved.', 8, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9b6487f4-e134-5231-a904-1e7dd13cf0e4', '172618f3-783e-52e3-acc3-64d759bfca8f', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Indicator quiz', 'quiz', '> **Demo lesson.** The full content for "Indicator quiz" will be published once course material and instructor rights are approved.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('cff5d8ec-e10f-5e9a-a1fe-7b5d5b1de6d4', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', '9b6487f4-e134-5231-a904-1e7dd13cf0e4', 'Indicator quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('b04dc216-5abb-57b9-a1ca-f3191c340d7c', 'cff5d8ec-e10f-5e9a-a1fe-7b5d5b1de6d4', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('8e36c830-3ffe-5386-a0a9-cea0910bf5c5', 'cff5d8ec-e10f-5e9a-a1fe-7b5d5b1de6d4', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('bc6bfb58-1fcc-5518-a4a3-c0c15d1ad11d', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Risk management', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('c3dce722-3986-5057-af6a-f6a9273a8d31', 'bc6bfb58-1fcc-5518-a4a3-c0c15d1ad11d', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Position sizing and stop-losses', 'video', '> **Demo lesson.** The full content for "Position sizing and stop-losses" will be published once course material and instructor rights are approved.', 16, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('ed0d0509-c2ab-5c7f-a7de-d37c3dc8d0fa', 'bc6bfb58-1fcc-5518-a4a3-c0c15d1ad11d', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'Assignment: annotate a chart', 'assignment', '> **Demo lesson.** The full content for "Assignment: annotate a chart" will be published once course material and instructor rights are approved.', 40, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('8badd801-4aa6-5315-a642-2426a462a949', 'a9d647f9-3852-52f4-a5fa-dade3dbfabee', 'ed0d0509-c2ab-5c7f-a7de-d37c3dc8d0fa', 'annotate a chart', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('45a34eca-a22f-54a2-a563-6e57b6e05159', 'fundamental-analysis-equity-research', 'Fundamental Analysis and Equity Research', 'Read annual reports and build an investment thesis.', 'Analyse businesses the way equity researchers do: industry structure, financial statements, ratios, valuation basics and writing a concise research note.', (select id from public.categories where slug = 'finance-stock-market'), '/thumbnails/fundamental-analysis-equity-research.svg', 149900, 'intermediate', 'English', 221, array['Read the three financial statements', 'Compute and interpret key ratios', 'Apply relative valuation', 'Write a one-page research note']::text[], array['Basic accounting knowledge is helpful']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('1968fdad-7f3a-5702-ada8-69a0058d647e', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Understanding the business', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('26771aac-be8f-560c-afeb-1cfe6cf3eb0c', '1968fdad-7f3a-5702-ada8-69a0058d647e', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Industry and competitive analysis', 'video', '> **Demo lesson.** The full content for "Industry and competitive analysis" will be published once course material and instructor rights are approved.', 18, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('cdabe0ae-fe82-55c1-a65e-358684b28372', '1968fdad-7f3a-5702-ada8-69a0058d647e', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Management and governance signals', 'text', '> **Demo lesson.** The full content for "Management and governance signals" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('dd0a673f-f737-5a3b-a1bf-ceeb8c77fce0', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Financial statements', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('38c2e664-4ff1-58e2-a9a9-da5e0f7b63b1', 'dd0a673f-f737-5a3b-a1bf-ceeb8c77fce0', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Income statement', 'video', '> **Demo lesson.** The full content for "Income statement" will be published once course material and instructor rights are approved.', 16, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('bc5416f5-18a2-583a-a894-62b6723634b3', 'dd0a673f-f737-5a3b-a1bf-ceeb8c77fce0', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Balance sheet', 'video', '> **Demo lesson.** The full content for "Balance sheet" will be published once course material and instructor rights are approved.', 16, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f72b5d6a-9ac7-5c96-a873-da2ec9e4cf2d', 'dd0a673f-f737-5a3b-a1bf-ceeb8c77fce0', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Cash flow statement', 'video', '> **Demo lesson.** The full content for "Cash flow statement" will be published once course material and instructor rights are approved.', 16, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('94bb0f49-3c18-586d-aeee-26f7ece7b873', 'dd0a673f-f737-5a3b-a1bf-ceeb8c77fce0', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Ratio analysis workbook', 'pdf', '> **Demo lesson.** The full content for "Ratio analysis workbook" will be published once course material and instructor rights are approved.', 20, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('ac00e23e-e849-551b-a869-258c1b344e14', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Valuation and reporting', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('0aa92bd6-12a3-52f2-ac65-c698a933def3', 'ac00e23e-e849-551b-a869-258c1b344e14', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Relative valuation', 'video', '> **Demo lesson.** The full content for "Relative valuation" will be published once course material and instructor rights are approved.', 18, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('2956ca89-f402-5304-a925-c8e60bc33a44', 'ac00e23e-e849-551b-a869-258c1b344e14', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Valuation quiz', 'quiz', '> **Demo lesson.** The full content for "Valuation quiz" will be published once course material and instructor rights are approved.', 15, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('b2bf2f0f-36d0-5215-a2da-1c40bb706624', '45a34eca-a22f-54a2-a563-6e57b6e05159', '2956ca89-f402-5304-a925-c8e60bc33a44', 'Valuation quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('ee07abd3-d68b-52df-aa9d-972f78d84236', 'b2bf2f0f-36d0-5215-a2da-1c40bb706624', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('d0e1e77b-00dc-5a80-a361-768aa31dee3f', 'b2bf2f0f-36d0-5215-a2da-1c40bb706624', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('ff82f6a1-a783-516f-af71-f9c7c7acf7c8', 'ac00e23e-e849-551b-a869-258c1b344e14', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'Assignment: research note', 'assignment', '> **Demo lesson.** The full content for "Assignment: research note" will be published once course material and instructor rights are approved.', 90, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('31b04e58-6f35-5cea-ac7c-328b2733d17b', '45a34eca-a22f-54a2-a563-6e57b6e05159', 'ff82f6a1-a783-516f-af71-f9c7c7acf7c8', 'research note', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'financial-modelling-with-excel', 'Financial Modelling with Excel', 'Build a three-statement model and a simple DCF.', 'Hands-on financial modelling: structure, assumptions, linking the three statements, scenario analysis and a discounted cash flow valuation.', (select id from public.categories where slug = 'finance-stock-market'), '/thumbnails/financial-modelling-with-excel.svg', 199900, 'intermediate', 'English', 239, array['Structure a clean, auditable model', 'Link the income statement, balance sheet and cash flow', 'Build a DCF with sensitivity tables', 'Present model outputs clearly']::text[], array['Comfort with Excel basics', 'Understanding of financial statements']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('c5dedb26-8193-5da5-ab7b-60d0fd19bc10', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Model design', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('4090d76b-67e0-55de-a6a1-6ecc4eefcfc8', 'c5dedb26-8193-5da5-ab7b-60d0fd19bc10', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Model layout and best practice', 'video', '> **Demo lesson.** The full content for "Model layout and best practice" will be published once course material and instructor rights are approved.', 14, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f495b6a8-2dd8-5630-af06-338504cedd44', 'c5dedb26-8193-5da5-ab7b-60d0fd19bc10', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Assumptions sheet', 'video', '> **Demo lesson.** The full content for "Assumptions sheet" will be published once course material and instructor rights are approved.', 15, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('f57e2378-af16-5576-a598-68c82a1b2d39', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Three-statement model', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('45be60c5-f634-5b79-aa25-23b1840f4150', 'f57e2378-af16-5576-a598-68c82a1b2d39', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Revenue and cost build', 'video', '> **Demo lesson.** The full content for "Revenue and cost build" will be published once course material and instructor rights are approved.', 20, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('6949b789-255d-5fb7-a442-c02c84810546', 'f57e2378-af16-5576-a598-68c82a1b2d39', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Balancing the balance sheet', 'video', '> **Demo lesson.** The full content for "Balancing the balance sheet" will be published once course material and instructor rights are approved.', 22, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b9e9160c-f6a3-5711-adf1-1c3efae57e88', 'f57e2378-af16-5576-a598-68c82a1b2d39', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Template workbook', 'pdf', '> **Demo lesson.** The full content for "Template workbook" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('d1745c80-3b91-5401-a1b1-6eca6226dfdd', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Valuation', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f1ccd963-6f0b-5c87-a255-ec9ce259bfce', 'd1745c80-3b91-5401-a1b1-6eca6226dfdd', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'DCF valuation', 'video', '> **Demo lesson.** The full content for "DCF valuation" will be published once course material and instructor rights are approved.', 24, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('0750a339-6e9c-52e0-a40e-4963f060bbfa', 'd1745c80-3b91-5401-a1b1-6eca6226dfdd', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Sensitivity analysis', 'video', '> **Demo lesson.** The full content for "Sensitivity analysis" will be published once course material and instructor rights are approved.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8e9112a4-debf-5ff0-aaf8-bbe0f4aa49f5', 'd1745c80-3b91-5401-a1b1-6eca6226dfdd', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', 'Assignment: complete the model', 'assignment', '> **Demo lesson.** The full content for "Assignment: complete the model" will be published once course material and instructor rights are approved.', 120, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('7a0c2b16-1cfa-5d51-a05b-8b94e584d725', 'b9a7473c-d1a1-5aa3-a9e6-6f656cae6303', '8e9112a4-debf-5ff0-aaf8-bbe0f4aa49f5', 'complete the model', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('42574e73-2c71-500b-a5a5-b502285e1c41', 'advanced-excel-for-finance', 'Advanced Excel for Finance', 'Lookups, dynamic arrays, pivots and dashboards for finance work.', 'The Excel skills finance teams use daily: XLOOKUP, dynamic arrays, pivot tables, data validation, financial functions and building clear dashboards.', (select id from public.categories where slug = 'finance-stock-market'), '/thumbnails/advanced-excel-for-finance.svg', 99900, 'intermediate', 'English', 148, array['Use XLOOKUP, INDEX/MATCH and dynamic arrays', 'Summarise data with pivot tables', 'Apply NPV, IRR and PMT correctly', 'Build a one-page finance dashboard']::text[], array['Basic Excel familiarity']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('7b865217-2d2a-5747-a65f-86ccaab3a212', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Core functions', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8e00bae3-b588-5a92-a200-32c51283fddc', '7b865217-2d2a-5747-a65f-86ccaab3a212', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Lookups that don''t break', 'video', '> **Demo lesson.** The full content for "Lookups that don''t break" will be published once course material and instructor rights are approved.', 15, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('34e4aace-cc8b-5989-a56d-2e53a091896b', '7b865217-2d2a-5747-a65f-86ccaab3a212', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Dynamic arrays', 'video', '> **Demo lesson.** The full content for "Dynamic arrays" will be published once course material and instructor rights are approved.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('c93ed855-8834-547b-a407-227307ca12f7', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Analysis', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('7d08d135-aef1-5bc1-a578-aa818e3870e7', 'c93ed855-8834-547b-a407-227307ca12f7', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Pivot tables', 'video', '> **Demo lesson.** The full content for "Pivot tables" will be published once course material and instructor rights are approved.', 16, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9827d516-d9cc-557b-ad3f-9850c40e2d92', 'c93ed855-8834-547b-a407-227307ca12f7', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Financial functions', 'video', '> **Demo lesson.** The full content for "Financial functions" will be published once course material and instructor rights are approved.', 15, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('4b968d78-0287-576b-a03a-d40234099715', 'c93ed855-8834-547b-a407-227307ca12f7', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Functions quiz', 'quiz', '> **Demo lesson.** The full content for "Functions quiz" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('f4e966f2-6fc5-5234-a92b-3884e670b265', '42574e73-2c71-500b-a5a5-b502285e1c41', '4b968d78-0287-576b-a03a-d40234099715', 'Functions quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('afca83fa-b0b2-5dec-a99b-42ee8f0bd89d', 'f4e966f2-6fc5-5234-a92b-3884e670b265', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('e2354e36-91ff-5b51-a319-5f20bf9fb822', 'f4e966f2-6fc5-5234-a92b-3884e670b265', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('4548b79a-6174-5c80-a662-c7bad3f26a3b', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Presentation', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('dc6dd08b-2d82-5226-a6df-e4fa28009b28', '4548b79a-6174-5c80-a662-c7bad3f26a3b', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Dashboard design', 'video', '> **Demo lesson.** The full content for "Dashboard design" will be published once course material and instructor rights are approved.', 18, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('48346d39-91c0-55fc-a517-4387641f6649', '4548b79a-6174-5c80-a662-c7bad3f26a3b', '42574e73-2c71-500b-a5a5-b502285e1c41', 'Assignment: monthly MIS dashboard', 'assignment', '> **Demo lesson.** The full content for "Assignment: monthly MIS dashboard" will be published once course material and instructor rights are approved.', 60, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('5835b57e-9b64-5833-ad6b-f031c04fdab6', '42574e73-2c71-500b-a5a5-b502285e1c41', '48346d39-91c0-55fc-a517-4387641f6649', 'monthly MIS dashboard', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'generative-ai-for-students', 'Generative AI for Students', 'What generative AI is, how to use it well, and how to use it honestly.', 'A practical, non-technical course on large language models and image generators: how they work at a high level, where they help in study and work, their limits, and academic-integrity considerations.', (select id from public.categories where slug = 'technology-ai'), '/thumbnails/generative-ai-for-students.svg', 49900, 'beginner', 'English', 84, array['Explain how LLMs generate text at a high level', 'Use AI assistants for research, drafting and revision', 'Check AI output for errors and bias', 'Follow academic-integrity rules when using AI']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('190f2dab-54ad-55ce-a097-4fee4521badd', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Foundations', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('0c15624f-2ce7-58ed-a052-31c0f276b5e1', '190f2dab-54ad-55ce-a097-4fee4521badd', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'What generative AI is', 'video', '> **Demo lesson.** The full content for "What generative AI is" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('28e642b0-3d3d-59f4-ac79-fa85ecb8da97', '190f2dab-54ad-55ce-a097-4fee4521badd', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Strengths and limits', 'video', '> **Demo lesson.** The full content for "Strengths and limits" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('82dd15f3-104a-55cc-aee0-66d4dd89ffe5', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Using AI well', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('42d10b0e-ba4b-5f13-a2b9-e621f3ff2023', '82dd15f3-104a-55cc-aee0-66d4dd89ffe5', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Research and summarising', 'video', '> **Demo lesson.** The full content for "Research and summarising" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9d23f326-8fd2-5976-a0cf-0cd5c0111d73', '82dd15f3-104a-55cc-aee0-66d4dd89ffe5', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Drafting and editing', 'video', '> **Demo lesson.** The full content for "Drafting and editing" will be published once course material and instructor rights are approved.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('bbc487cd-e32b-5520-a5be-956c8d449a8f', '82dd15f3-104a-55cc-aee0-66d4dd89ffe5', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Fact-checking AI output', 'text', '> **Demo lesson.** The full content for "Fact-checking AI output" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('4ba370cd-6b54-58d0-aee2-5aaa23335347', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Responsible use', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('cabffd70-5812-57f9-ac0f-d0ba0843e503', '4ba370cd-6b54-58d0-aee2-5aaa23335347', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Academic integrity and privacy', 'video', '> **Demo lesson.** The full content for "Academic integrity and privacy" will be published once course material and instructor rights are approved.', 12, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('aaf535f5-f744-5159-a75e-6f75e6c05b69', '4ba370cd-6b54-58d0-aee2-5aaa23335347', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'Final quiz', 'quiz', '> **Demo lesson.** The full content for "Final quiz" will be published once course material and instructor rights are approved.', 10, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('11719fab-13ce-579c-afc0-9fcc78d14172', '48285f79-80e6-5ec1-a40d-98710eaeb8d7', 'aaf535f5-f744-5159-a75e-6f75e6c05b69', 'Final quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('5a693aba-65c1-5eec-a44f-5b4798054adf', '11719fab-13ce-579c-afc0-9fcc78d14172', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('982bd3a1-0c7e-5210-a698-714fb73d077e', '11719fab-13ce-579c-afc0-9fcc78d14172', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('0db2469a-5663-54ca-ab1d-810c0fa20135', 'prompt-engineering', 'Prompt Engineering', 'Write clear prompts that get reliable results.', 'Learn systematic prompting: giving context, examples and constraints, structuring outputs, iterating, and evaluating results for real tasks.', (select id from public.categories where slug = 'technology-ai'), '/thumbnails/prompt-engineering.svg', 69900, 'beginner', 'English', 115, array['Write prompts with clear context, task and format', 'Use examples and step-by-step instructions', 'Request structured output', 'Evaluate and iterate on prompts']::text[], array['Access to any AI assistant']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('0413d369-8af5-5b03-a6ab-43a51878b210', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Principles', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('c3f19685-782e-55f3-ac12-5ec2b09ff3a4', '0413d369-8af5-5b03-a6ab-43a51878b210', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Anatomy of a good prompt', 'video', '> **Demo lesson.** The full content for "Anatomy of a good prompt" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b7ae623e-6ece-57f1-a0c2-afcf5c8470a1', '0413d369-8af5-5b03-a6ab-43a51878b210', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Context and constraints', 'video', '> **Demo lesson.** The full content for "Context and constraints" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('42912ae3-9f35-5d66-a1f5-9bf87a1dc408', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Techniques', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('2b4d8da7-879f-5cde-a932-78612dda7a5d', '42912ae3-9f35-5d66-a1f5-9bf87a1dc408', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Examples and few-shot prompting', 'video', '> **Demo lesson.** The full content for "Examples and few-shot prompting" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('e98b479f-ee86-52d0-ae9b-014932688ecf', '42912ae3-9f35-5d66-a1f5-9bf87a1dc408', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Structured outputs', 'video', '> **Demo lesson.** The full content for "Structured outputs" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('d4b4ca4c-5b2e-54d4-a73b-0cac0725e327', '42912ae3-9f35-5d66-a1f5-9bf87a1dc408', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Techniques quiz', 'quiz', '> **Demo lesson.** The full content for "Techniques quiz" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('f3a078ba-e5bb-580c-a2f4-ef2f3448dbe7', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'd4b4ca4c-5b2e-54d4-a73b-0cac0725e327', 'Techniques quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('714747f2-472d-53b6-a5f6-1ba08a1d94f2', 'f3a078ba-e5bb-580c-a2f4-ef2f3448dbe7', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('c1c9538e-906f-5b2f-aeba-015673c3e13a', 'f3a078ba-e5bb-580c-a2f4-ef2f3448dbe7', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('e2198178-dcaa-57ad-a603-0fbd0177d3ea', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Practice', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('adbdaade-5e02-5eb2-a95c-4a2fc0e5c3e5', 'e2198178-dcaa-57ad-a603-0fbd0177d3ea', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Evaluating prompt quality', 'text', '> **Demo lesson.** The full content for "Evaluating prompt quality" will be published once course material and instructor rights are approved.', 10, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('0c561925-6992-5f27-ab4a-65595cd754e1', 'e2198178-dcaa-57ad-a603-0fbd0177d3ea', '0db2469a-5663-54ca-ab1d-810c0fa20135', 'Assignment: prompt library for your field', 'assignment', '> **Demo lesson.** The full content for "Assignment: prompt library for your field" will be published once course material and instructor rights are approved.', 45, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('a3299bab-516b-5198-ae42-c2fdd5e8f84f', '0db2469a-5663-54ca-ab1d-810c0fa20135', '0c561925-6992-5f27-ab4a-65595cd754e1', 'prompt library for your field', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('c6753818-1bb2-579d-ab1f-99300969713b', 'ai-tools-and-productivity', 'AI Tools and Productivity', 'Use AI tools for notes, spreadsheets, presentations and research.', 'A tour of practical AI workflows for students and early-career professionals, with a focus on saving time without sacrificing accuracy.', (select id from public.categories where slug = 'technology-ai'), '/thumbnails/ai-tools-and-productivity.svg', 49900, 'beginner', 'English', 98, array['Choose the right AI tool for a task', 'Automate note-taking and summaries', 'Speed up spreadsheet and slide work', 'Build a personal productivity workflow']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('609fda34-38f9-54c1-a601-28ce4837f29b', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Choosing tools', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('cbd8aa4c-d14b-5446-a844-c7f8a2830326', '609fda34-38f9-54c1-a601-28ce4837f29b', 'c6753818-1bb2-579d-ab1f-99300969713b', 'The AI tool landscape', 'video', '> **Demo lesson.** The full content for "The AI tool landscape" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('33e2fa52-d433-5156-a0ab-e16c69e14dec', '609fda34-38f9-54c1-a601-28ce4837f29b', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Privacy and data considerations', 'text', '> **Demo lesson.** The full content for "Privacy and data considerations" will be published once course material and instructor rights are approved.', 8, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('74704680-0822-5c10-ad79-6757e60d2e8d', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Workflows', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('af89cabb-144f-598f-a2b6-7d358f079539', '74704680-0822-5c10-ad79-6757e60d2e8d', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Notes and summaries', 'video', '> **Demo lesson.** The full content for "Notes and summaries" will be published once course material and instructor rights are approved.', 12, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('0051673a-1e8f-52a1-aef1-c00a2eda9c50', '74704680-0822-5c10-ad79-6757e60d2e8d', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Spreadsheets with AI', 'video', '> **Demo lesson.** The full content for "Spreadsheets with AI" will be published once course material and instructor rights are approved.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('aee6affe-c33e-5dc1-ad8c-e6b75d740433', '74704680-0822-5c10-ad79-6757e60d2e8d', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Presentations with AI', 'video', '> **Demo lesson.** The full content for "Presentations with AI" will be published once course material and instructor rights are approved.', 12, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('824cf1e5-ac96-52d3-a601-f0e29189dfab', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Your system', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('65f68897-e8c2-5904-a58f-a3371e728d7f', '824cf1e5-ac96-52d3-a601-f0e29189dfab', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Designing a weekly workflow', 'video', '> **Demo lesson.** The full content for "Designing a weekly workflow" will be published once course material and instructor rights are approved.', 10, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('675059f4-ca4a-5c4a-a5af-0d747d9ab411', '824cf1e5-ac96-52d3-a601-f0e29189dfab', 'c6753818-1bb2-579d-ab1f-99300969713b', 'Assignment: document your workflow', 'assignment', '> **Demo lesson.** The full content for "Assignment: document your workflow" will be published once course material and instructor rights are approved.', 30, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('77321241-02cb-513c-aa48-c0f07cf0b04f', 'c6753818-1bb2-579d-ab1f-99300969713b', '675059f4-ca4a-5c4a-a5af-0d747d9ab411', 'document your workflow', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'introduction-to-data-analytics', 'Introduction to Data Analytics', 'Clean, analyse and visualise data with spreadsheets and SQL basics.', 'Learn the analytics workflow end to end: asking good questions, cleaning data, descriptive statistics, SQL fundamentals and communicating findings with charts.', (select id from public.categories where slug = 'technology-ai'), '/thumbnails/introduction-to-data-analytics.svg', 99900, 'beginner', 'English', 178, array['Frame an analytical question', 'Clean and prepare a dataset', 'Write basic SQL queries', 'Choose the right chart for a message']::text[], array['Basic spreadsheet use']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('f2aeb682-0be6-59f0-a541-9ad8af017b2f', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'The analytics workflow', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8de624e5-c1ab-5b45-abc8-28fdc2dd1da7', 'f2aeb682-0be6-59f0-a541-9ad8af017b2f', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'From question to insight', 'video', '> **Demo lesson.** The full content for "From question to insight" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('160990aa-3121-5a16-aa9f-55c2e1c2c01c', 'f2aeb682-0be6-59f0-a541-9ad8af017b2f', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'Data cleaning', 'video', '> **Demo lesson.** The full content for "Data cleaning" will be published once course material and instructor rights are approved.', 16, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('11a49e86-f0af-5302-a715-d3a332f56b0b', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'Analysis', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('79c02e03-8976-5398-a155-535e62975b16', '11a49e86-f0af-5302-a715-d3a332f56b0b', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'Descriptive statistics', 'video', '> **Demo lesson.** The full content for "Descriptive statistics" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3f8f84b3-3989-5862-aa76-edd8b07ea7c2', '11a49e86-f0af-5302-a715-d3a332f56b0b', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'SQL fundamentals', 'video', '> **Demo lesson.** The full content for "SQL fundamentals" will be published once course material and instructor rights are approved.', 20, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3ab3c3bb-f5a9-5112-a2b5-ae2c5481df3f', '11a49e86-f0af-5302-a715-d3a332f56b0b', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'SQL quiz', 'quiz', '> **Demo lesson.** The full content for "SQL quiz" will be published once course material and instructor rights are approved.', 12, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('c9437d08-03d8-5fde-a124-b69e34b01cb0', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', '3ab3c3bb-f5a9-5112-a2b5-ae2c5481df3f', 'SQL quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('b33f5eea-24b1-5c55-a6ff-f8bd3da2a95f', 'c9437d08-03d8-5fde-a124-b69e34b01cb0', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('046cc0e2-ccc8-5c36-a879-4fc8e8f11ca8', 'c9437d08-03d8-5fde-a124-b69e34b01cb0', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('905966b1-ed48-557a-ae56-33183339d426', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'Communication', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('ab0cefc1-50e8-59f9-a5b1-1d38cc882007', '905966b1-ed48-557a-ae56-33183339d426', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'Visualisation principles', 'video', '> **Demo lesson.** The full content for "Visualisation principles" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('75a6f276-b859-5559-a1f4-1e6f33c1a3c8', '905966b1-ed48-557a-ae56-33183339d426', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', 'Assignment: analyse a public dataset', 'assignment', '> **Demo lesson.** The full content for "Assignment: analyse a public dataset" will be published once course material and instructor rights are approved.', 90, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('02980cb8-c2da-5d6f-a835-12a31d42d2b7', '290c4049-d9c7-5a79-ac68-acdf627bf1f6', '75a6f276-b859-5559-a1f4-1e6f33c1a3c8', 'analyse a public dataset', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('134532f7-c2f7-5b5f-aa19-3a59829c240e', 'digital-marketing-fundamentals', 'Digital Marketing Fundamentals', 'Channels, funnels, budgets and measurement.', 'An overview of digital marketing for students and new marketers: customer journeys, owned/earned/paid channels, campaign planning, budgeting and analytics.', (select id from public.categories where slug = 'business-marketing'), '/thumbnails/digital-marketing-fundamentals.svg', 59900, 'beginner', 'English', 134, array['Map a customer journey', 'Compare digital channels', 'Plan a small campaign with a budget', 'Define and track KPIs']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('5aefe6a9-c7d2-559a-ae41-f992581abc01', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Foundations', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('425cd890-f43d-5c41-ad97-f411ce7bbad9', '5aefe6a9-c7d2-559a-ae41-f992581abc01', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Marketing funnels', 'video', '> **Demo lesson.** The full content for "Marketing funnels" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f4591105-6f63-583a-a8d2-f88da0ec70fe', '5aefe6a9-c7d2-559a-ae41-f992581abc01', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Channels overview', 'video', '> **Demo lesson.** The full content for "Channels overview" will be published once course material and instructor rights are approved.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('2d1fe295-f105-5aa0-ada8-a1adb03531b2', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Campaigns', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('33e09cda-c255-5100-a1f7-7fd41845622e', '2d1fe295-f105-5aa0-ada8-a1adb03531b2', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Planning a campaign', 'video', '> **Demo lesson.** The full content for "Planning a campaign" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('eb2b54c2-bc29-5918-a2bb-bedc93360dc2', '2d1fe295-f105-5aa0-ada8-a1adb03531b2', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Budgets and bidding basics', 'text', '> **Demo lesson.** The full content for "Budgets and bidding basics" will be published once course material and instructor rights are approved.', 10, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('d7183a37-3886-5fc7-ac6b-d6bbb6927939', '2d1fe295-f105-5aa0-ada8-a1adb03531b2', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Campaign quiz', 'quiz', '> **Demo lesson.** The full content for "Campaign quiz" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('aab92305-7799-5a6c-a159-98a9f5706459', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'd7183a37-3886-5fc7-ac6b-d6bbb6927939', 'Campaign quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('55bb605d-8274-5553-ab79-8aa2a2b990bc', 'aab92305-7799-5a6c-a159-98a9f5706459', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('d064d7d9-67ad-54a8-adb9-00aa4446e109', 'aab92305-7799-5a6c-a159-98a9f5706459', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('0c404ee3-461b-5911-aa9f-d3b5071d32ef', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Measurement', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('97730443-0e53-5453-ad5a-db812020a28f', '0c404ee3-461b-5911-aa9f-d3b5071d32ef', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'KPIs and analytics', 'video', '> **Demo lesson.** The full content for "KPIs and analytics" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('2b6bb26b-4617-507c-aabc-b35ff95bb0a1', '0c404ee3-461b-5911-aa9f-d3b5071d32ef', '134532f7-c2f7-5b5f-aa19-3a59829c240e', 'Assignment: campaign plan', 'assignment', '> **Demo lesson.** The full content for "Assignment: campaign plan" will be published once course material and instructor rights are approved.', 60, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('cb30fbed-23db-52a9-af34-9c62d42b6e43', '134532f7-c2f7-5b5f-aa19-3a59829c240e', '2b6bb26b-4617-507c-aabc-b35ff95bb0a1', 'campaign plan', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('d5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'seo-and-content-marketing', 'SEO and Content Marketing', 'Keyword research, on-page SEO and content that earns attention.', 'Learn how search engines rank content, how to research keywords, optimise pages, plan a content calendar and measure organic growth.', (select id from public.categories where slug = 'business-marketing'), '/thumbnails/seo-and-content-marketing.svg', 69900, 'beginner', 'English', 123, array['Do keyword research', 'Optimise a page for search', 'Plan a content calendar', 'Measure organic performance']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('0d9071d5-4b6e-5c88-aa29-7dc2f88984c3', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'How search works', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('6c4606bc-1b19-58da-adf9-c0a19d5c5c09', '0d9071d5-4b6e-5c88-aa29-7dc2f88984c3', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'Crawling, indexing and ranking', 'video', '> **Demo lesson.** The full content for "Crawling, indexing and ranking" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('4bf77c7e-e1fc-5df7-ac07-41fd6e18b308', '0d9071d5-4b6e-5c88-aa29-7dc2f88984c3', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'Keyword research', 'video', '> **Demo lesson.** The full content for "Keyword research" will be published once course material and instructor rights are approved.', 16, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('2e2080cc-e3a6-50af-a4ab-425ce63f3dc8', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'Optimisation', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('cf071dbd-251e-5118-afe4-2d0403e1dc56', '2e2080cc-e3a6-50af-a4ab-425ce63f3dc8', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'On-page SEO', 'video', '> **Demo lesson.** The full content for "On-page SEO" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('1a3854b7-d64a-5bc1-ae1f-bc8ee402c83d', '2e2080cc-e3a6-50af-a4ab-425ce63f3dc8', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'Technical SEO basics', 'text', '> **Demo lesson.** The full content for "Technical SEO basics" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('afc5a0a4-1e5c-5171-a1fb-bcb10443fadd', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'Content', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('eecbed95-73a3-54de-a81b-9a3bf200a12e', 'afc5a0a4-1e5c-5171-a1fb-bcb10443fadd', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'Content strategy and calendars', 'video', '> **Demo lesson.** The full content for "Content strategy and calendars" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('ad4a9c8a-c784-5c20-ae9f-b12a7d8f005f', 'afc5a0a4-1e5c-5171-a1fb-bcb10443fadd', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'SEO quiz', 'quiz', '> **Demo lesson.** The full content for "SEO quiz" will be published once course material and instructor rights are approved.', 10, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('6bfdbcad-2d46-596d-aba3-0917e4040c05', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'ad4a9c8a-c784-5c20-ae9f-b12a7d8f005f', 'SEO quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('f58956c4-71ef-5dc7-a375-f41fb5f6ca0c', '6bfdbcad-2d46-596d-aba3-0917e4040c05', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('dae84f15-e4e0-59ba-a355-02f805e27576', '6bfdbcad-2d46-596d-aba3-0917e4040c05', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('cd41d052-32d3-5466-a303-8c419ad3afbc', 'afc5a0a4-1e5c-5171-a1fb-bcb10443fadd', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'Assignment: optimise a blog post', 'assignment', '> **Demo lesson.** The full content for "Assignment: optimise a blog post" will be published once course material and instructor rights are approved.', 45, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('b93e8607-3219-543b-a674-55ed33ee1fc6', 'd5f0e7ef-0ffe-5cc8-a385-4f0586fad89e', 'cd41d052-32d3-5466-a303-8c419ad3afbc', 'optimise a blog post', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('fcdffd44-e4ae-5134-a123-f5adc10ede71', 'social-media-marketing', 'Social Media Marketing', 'Plan, create and measure content for social platforms.', 'Build social media strategies: audience research, platform selection, content pillars, short-form video, community management and analytics.', (select id from public.categories where slug = 'business-marketing'), '/thumbnails/social-media-marketing.svg', 59900, 'beginner', 'English', 122, array['Define audience personas', 'Create content pillars and a posting plan', 'Script short-form video', 'Read platform analytics']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('29ac32c1-ace3-58c7-a6a5-a1cd964531bd', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Strategy', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f8bbc4fb-9ef4-52b4-a026-58c0ab8ec8f0', '29ac32c1-ace3-58c7-a6a5-a1cd964531bd', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Audience and platform choice', 'video', '> **Demo lesson.** The full content for "Audience and platform choice" will be published once course material and instructor rights are approved.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('a9f8edec-9a7d-5111-aec4-d445f5c9bfa2', '29ac32c1-ace3-58c7-a6a5-a1cd964531bd', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Content pillars', 'video', '> **Demo lesson.** The full content for "Content pillars" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('c82a0c7e-3a75-5f62-a76e-34a1bbef4470', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Creation', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3d7530ef-9ffb-544f-a5db-fc408c118874', 'c82a0c7e-3a75-5f62-a76e-34a1bbef4470', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Short-form video scripting', 'video', '> **Demo lesson.** The full content for "Short-form video scripting" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('7e5d10d9-ad52-5bc4-a04d-ce4c572313dc', 'c82a0c7e-3a75-5f62-a76e-34a1bbef4470', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Design basics for social', 'video', '> **Demo lesson.** The full content for "Design basics for social" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('d00233dc-a53c-569e-ad51-501f6592b0ef', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Growth', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('509facbb-1a4f-5fd7-a6e9-cb630ea3ae15', 'd00233dc-a53c-569e-ad51-501f6592b0ef', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Community and analytics', 'video', '> **Demo lesson.** The full content for "Community and analytics" will be published once course material and instructor rights are approved.', 12, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f234882b-2bf6-540f-acf3-54953663aeff', 'd00233dc-a53c-569e-ad51-501f6592b0ef', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'Assignment: 30-day content plan', 'assignment', '> **Demo lesson.** The full content for "Assignment: 30-day content plan" will be published once course material and instructor rights are approved.', 60, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('106de892-adcc-5c90-aa30-ac5f69322cb9', 'fcdffd44-e4ae-5134-a123-f5adc10ede71', 'f234882b-2bf6-540f-acf3-54953663aeff', '30-day content plan', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'resume-building-and-linkedin', 'Resume Building and LinkedIn', 'Write a resume and LinkedIn profile that show your real strengths.', 'Turn your education, projects and experience into a clear resume and LinkedIn profile, tailored to roles you want — truthfully and effectively.', (select id from public.categories where slug = 'career-development'), '/thumbnails/resume-building-and-linkedin.svg', 29900, 'beginner', 'English', 92, array['Write achievement-focused bullet points', 'Tailor a resume to a role', 'Optimise a LinkedIn profile', 'Network professionally']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('3cc33ba9-fc18-50e4-a240-5f2c2df7dca0', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'Resume', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('546275ae-f1ff-583a-a8ca-7a988e5f3036', '3cc33ba9-fc18-50e4-a240-5f2c2df7dca0', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'What recruiters look for', 'video', '> **Demo lesson.** The full content for "What recruiters look for" will be published once course material and instructor rights are approved.', 10, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8630bfba-56b7-5292-a5bb-feb0c76c3bfd', '3cc33ba9-fc18-50e4-a240-5f2c2df7dca0', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'Writing strong bullet points', 'video', '> **Demo lesson.** The full content for "Writing strong bullet points" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('03a127e3-4c3e-5e05-ad98-12bc8045a784', '3cc33ba9-fc18-50e4-a240-5f2c2df7dca0', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'Resume template', 'pdf', '> **Demo lesson.** The full content for "Resume template" will be published once course material and instructor rights are approved.', 5, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('e20b6fcb-34eb-5590-a279-5b5f72aebf7f', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'LinkedIn', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('e3cb5175-804b-58fb-a4a6-a2b2f2a9df32', 'e20b6fcb-34eb-5590-a279-5b5f72aebf7f', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'Profile essentials', 'video', '> **Demo lesson.** The full content for "Profile essentials" will be published once course material and instructor rights are approved.', 12, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8efc57ac-7b4d-5eea-a1c5-0a2200520d07', 'e20b6fcb-34eb-5590-a279-5b5f72aebf7f', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'Networking messages', 'text', '> **Demo lesson.** The full content for "Networking messages" will be published once course material and instructor rights are approved.', 8, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('3ed5aba1-99a2-5d28-abe7-48efa6c03f90', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'Apply it', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('249ad96a-b30c-59a3-a700-65970f0a0a69', '3ed5aba1-99a2-5d28-abe7-48efa6c03f90', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', 'Assignment: submit your resume for feedback', 'assignment', '> **Demo lesson.** The full content for "Assignment: submit your resume for feedback" will be published once course material and instructor rights are approved.', 45, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('26d94340-2599-5ca1-abea-d9a736b470a9', '02ca1a0f-9336-57f3-ae03-a0ee376d831d', '249ad96a-b30c-59a3-a700-65970f0a0a69', 'submit your resume for feedback', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'interview-preparation', 'Interview Preparation', 'Prepare for HR, behavioural and technical interviews.', 'A practical guide to interviews: researching employers, answering behavioural questions with STAR, handling case and technical rounds, and following up.', (select id from public.categories where slug = 'career-development'), '/thumbnails/interview-preparation.svg', 39900, 'beginner', 'English', 66, array['Research a company and role', 'Answer behavioural questions with STAR', 'Approach case and technical questions', 'Ask good questions and follow up']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('847f6c8c-29db-580a-a9e8-0e6280630b67', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Preparation', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('bb39794a-02b4-5526-a848-05ccbaef0913', '847f6c8c-29db-580a-a9e8-0e6280630b67', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Researching the role', 'video', '> **Demo lesson.** The full content for "Researching the role" will be published once course material and instructor rights are approved.', 10, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('2e8d71bc-d5c5-5d8a-acaa-56923bd2436b', '847f6c8c-29db-580a-a9e8-0e6280630b67', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Your story in two minutes', 'video', '> **Demo lesson.** The full content for "Your story in two minutes" will be published once course material and instructor rights are approved.', 10, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('04c7b66a-9c7e-585f-a632-25fa85175285', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Answering well', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('081ad8b3-8b52-5c51-af2b-3b114ca610a1', '04c7b66a-9c7e-585f-a632-25fa85175285', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Behavioural questions and STAR', 'video', '> **Demo lesson.** The full content for "Behavioural questions and STAR" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('caf74f08-4167-5c5a-ae18-efe74785beb1', '04c7b66a-9c7e-585f-a632-25fa85175285', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Case and technical rounds', 'video', '> **Demo lesson.** The full content for "Case and technical rounds" will be published once course material and instructor rights are approved.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('7ba09832-f78f-5aac-afcf-747c181fd1e6', '04c7b66a-9c7e-585f-a632-25fa85175285', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Interview quiz', 'quiz', '> **Demo lesson.** The full content for "Interview quiz" will be published once course material and instructor rights are approved.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('60faea56-7346-5757-af88-0b7d661e2c99', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', '7ba09832-f78f-5aac-afcf-747c181fd1e6', 'Interview quiz', 'Demo quiz — final questions pending content approval.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('ec95c6fd-7b47-5a92-ac5d-12570f4a4908', '60faea56-7346-5757-af88-0b7d661e2c99', 'Demo question: which of these best describes a demo course?', '["It is available for purchase","It is a preview listing pending approval","It is a free course","It has been retired"]'::jsonb, 1, 'Demo listings are previews until content rights are approved.', 1),
  ('6a39a89e-399d-566a-a302-a26da5488be5', '60faea56-7346-5757-af88-0b7d661e2c99', 'Demo question: what is required for a SkillSpring certificate?', '["Only payment","Completing the course requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('106ffad7-38bf-51c3-a63d-c6b98e70abab', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'After the interview', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('d44b4d38-6342-52da-a238-2f1868d275f4', '106ffad7-38bf-51c3-a63d-c6b98e70abab', 'ad25f643-d5df-5192-add9-26c4a4ab1c8f', 'Follow-up and negotiation basics', 'text', '> **Demo lesson.** The full content for "Follow-up and negotiation basics" will be published once course material and instructor rights are approved.', 8, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'business-communication', 'Business Communication', 'Email, presentations and meetings that get things done.', 'Communicate clearly at work: professional email, structured writing, presentations, meetings and giving and receiving feedback.', (select id from public.categories where slug = 'career-development'), '/thumbnails/business-communication.svg', 39900, 'beginner', 'English', 84, array['Write clear professional emails', 'Structure documents and reports', 'Deliver confident presentations', 'Run and contribute to effective meetings']::text[], array['None']::text[], '[{"question":"Is this course available now?","answer":"Not yet. This is a demo listing. It will open for purchase once course material and instructor rights are approved."},{"question":"Will I get a certificate?","answer":"Yes, after you complete every mandatory lesson, submit required assignments and pass the quizzes. Each certificate has a public verification link."}]'::jsonb, 'published', 'pending', 'Demo listing: course material and instructor rights not yet approved.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs;
insert into public.course_modules (id, course_id, title, position) values ('5ca492e3-53b8-569f-af93-972ebab79a9e', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Writing', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('c1978f28-0f72-501c-a7cb-90e54bc15ab8', '5ca492e3-53b8-569f-af93-972ebab79a9e', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Professional email', 'video', '> **Demo lesson.** The full content for "Professional email" will be published once course material and instructor rights are approved.', 10, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8dc4705b-158d-5a32-a294-f201f0277e20', '5ca492e3-53b8-569f-af93-972ebab79a9e', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Structured writing', 'video', '> **Demo lesson.** The full content for "Structured writing" will be published once course material and instructor rights are approved.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('7d026637-3788-52b6-a4ba-bdf744cf94ea', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Speaking', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('fe0a8252-f2a8-5bb9-a8ca-84f152a17ea6', '7d026637-3788-52b6-a4ba-bdf744cf94ea', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Presentations', 'video', '> **Demo lesson.** The full content for "Presentations" will be published once course material and instructor rights are approved.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('04cf972b-b4f5-5bee-a9ee-30bd4a43cd4c', '7d026637-3788-52b6-a4ba-bdf744cf94ea', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Meetings', 'video', '> **Demo lesson.** The full content for "Meetings" will be published once course material and instructor rights are approved.', 10, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('1692ab9e-8bfa-5179-a7c7-ab8f0960d731', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Feedback', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('7c5f6b8d-7d63-5a7a-a177-cb631f54ba76', '1692ab9e-8bfa-5179-a7c7-ab8f0960d731', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Giving and receiving feedback', 'text', '> **Demo lesson.** The full content for "Giving and receiving feedback" will be published once course material and instructor rights are approved.', 8, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('43b125d6-6766-5847-aabb-361952036682', '1692ab9e-8bfa-5179-a7c7-ab8f0960d731', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', 'Assignment: rewrite a business email', 'assignment', '> **Demo lesson.** The full content for "Assignment: rewrite a business email" will be published once course material and instructor rights are approved.', 30, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('356b41b8-a8e5-5ee4-a4f8-8dfa1cba609f', 'cc8de120-f6f3-53d9-ac6a-7755abc6712c', '43b125d6-6766-5847-aabb-361952036682', 'rewrite a business email', 'Demo assignment — detailed brief pending content approval.', true) on conflict (id) do nothing;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('7a6da9e3-4ed2-52cd-a637-775a52ab4b69', 'equity-research-virtual-simulation', 'Equity Research Virtual Simulation', null, 'simulation', 'A guided, self-paced simulation of an equity research analyst''s work: analyse a listed company using public filings and produce a research note. Run by SkillSpring for learning purposes — this is not a job or an employer internship.', array['Study an annual report and recent filings', 'Build a ratio analysis', 'Write a one-page research note', 'Present your thesis in a short recorded pitch']::text[], array['Financial statements', 'Excel', 'Report writing']::text[], 'Open to all students. Basic accounting knowledge recommended.', 'Online', 'remote', 4, false, 'Unpaid educational experience run by SkillSpring.', current_date + 45, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('ae1766d5-644b-52d2-ac3c-94c57d5c2a9b', 'digital-marketing-campaign-project', 'Digital Marketing Campaign Project', null, 'project', 'Plan a complete digital campaign for a fictional brand brief: audience research, channel mix, content calendar, budget and KPI dashboard. Mentor feedback on submission. Educational project — not an employer placement.', array['Research the target audience', 'Design a channel mix and budget', 'Create a 4-week content calendar', 'Define KPIs and a reporting template']::text[], array['Digital marketing', 'Content planning', 'Spreadsheets']::text[], 'Open to all students.', 'Online', 'remote', 3, false, 'Unpaid educational experience run by SkillSpring.', current_date + 30, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('abf0a0b9-bb0e-59e5-a4b8-9db6dafb0167', 'data-analytics-case-study', 'Data Analytics Case Study Simulation', null, 'simulation', 'Work through a realistic analytics case using a public dataset: clean the data, answer business questions with SQL and spreadsheets, and present insights. Educational simulation run by SkillSpring.', array['Clean and document a dataset', 'Answer five business questions', 'Build three clear charts', 'Write an insights summary']::text[], array['SQL', 'Spreadsheets', 'Data visualisation']::text[], 'Open to all students. Introduction to Data Analytics recommended.', 'Online', 'remote', 4, false, 'Unpaid educational experience run by SkillSpring.', current_date + 60, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('8adb3a8a-a59c-5ded-af69-80254c97027b', 'financial-modelling-project', 'Financial Modelling Capstone Project', null, 'project', 'Build a three-statement model and DCF for a company of your choice using public information, with structured feedback. Educational capstone — not an employer internship.', array['Collect historical financials', 'Build linked statements', 'Run a DCF with sensitivities', 'Document assumptions']::text[], array['Financial modelling', 'Excel', 'Valuation']::text[], 'Students who have completed Financial Modelling with Excel or equivalent.', 'Online', 'remote', 6, false, 'Unpaid educational experience run by SkillSpring.', current_date + 75, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
commit;
