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
returns trigger language plpgsql set search_path = '' as $$
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

-- ===== supabase/migrations/20261122000005_api_grants.sql =====
-- Newer Supabase projects do not grant Data API roles access to new tables by default.
-- Row Level Security (enabled on every table) still decides which rows each role sees.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public grant all on tables to service_role;

-- ===== supabase/migrations/20261123000006_programs_catalogue.sql =====
-- Replace the original 15 demo course listings with the four SkillSpring programs
-- (inserted by seed.sql). Only demo rows with no enrolments, orders or applications
-- are removed, so this never deletes anything a student has touched.
delete from public.courses c
where c.is_demo
  and c.slug in (
    'stock-market-fundamentals', 'technical-analysis-for-beginners', 'fundamental-analysis-equity-research',
    'financial-modelling-with-excel', 'advanced-excel-for-finance', 'generative-ai-for-students', 'prompt-engineering',
    'ai-tools-and-productivity', 'introduction-to-data-analytics', 'digital-marketing-fundamentals',
    'seo-and-content-marketing', 'social-media-marketing', 'resume-building-and-linkedin', 'interview-preparation',
    'business-communication')
  and not exists (select 1 from public.enrolments e where e.course_id = c.id)
  and not exists (select 1 from public.orders o where o.course_id = c.id);

delete from public.internships i
where i.is_demo
  and i.slug in ('equity-research-virtual-simulation', 'data-analytics-case-study', 'financial-modelling-project')
  and not exists (select 1 from public.internship_applications a where a.internship_id = i.id);

delete from public.categories cat
where cat.slug in ('finance-stock-market', 'technology-ai', 'business-marketing', 'career-development')
  and not exists (select 1 from public.courses c where c.category_id = cat.id);

-- ===== supabase/migrations/20261123000007_campus_ambassadors.sql =====
-- Campus Ambassador programme: free applications from students.
create type public.ambassador_status as enum ('applied', 'shortlisted', 'active', 'rejected', 'inactive');

create table public.ambassador_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 2 and 120),
  email text not null check (char_length(email) <= 254),
  phone text not null check (phone ~ '^\+?[0-9 \-]{7,20}$'),
  college text not null check (char_length(college) between 2 and 200),
  city text not null check (char_length(city) between 2 and 120),
  course_and_year text not null check (char_length(course_and_year) between 2 and 120),
  social_url text check (social_url is null or social_url ~ '^https?://'),
  motivation text not null check (char_length(motivation) between 30 and 2000),
  user_id uuid references public.profiles (id) on delete set null,
  status public.ambassador_status not null default 'applied',
  referral_code text unique,
  admin_notes text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ambassador_applications_email_idx on public.ambassador_applications (lower(email));
create index ambassador_applications_status_idx on public.ambassador_applications (status, created_at desc);
create trigger set_updated_at before update on public.ambassador_applications
  for each row execute function private.set_updated_at();

alter table public.ambassador_applications enable row level security;

-- Applicants can see their own application; admins manage all.
-- Inserts happen server-side (service role) after validation and rate limiting.
create policy ambassador_select on public.ambassador_applications for select to authenticated
  using (user_id = (select auth.uid()) or private.is_admin());
create policy ambassador_admin on public.ambassador_applications for update to authenticated
  using (private.is_admin()) with check (private.is_admin());

grant select, insert, update, delete on public.ambassador_applications to anon, authenticated;
grant all on public.ambassador_applications to service_role;

-- ===== supabase/seed.sql =====
-- GENERATED by scripts/generate-seed.ts — do not edit by hand.
-- Programs start as is_demo = true ("Enrolment opens soon"): untick Demo in Admin once lesson videos are uploaded.
begin;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('3088f631-3550-528c-a5f6-ceb125745f4c', 'stock-market', 'Stock Market', 'Trading, investing and equity research.', 'trending-up', 1) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('d3fd1a54-8825-540b-ac81-54e7f4644bc5', 'web-development', 'Web Design & Development', 'Design and build modern websites.', 'code', 2) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('0479067a-54ff-580d-a7f7-a87cd2be3154', 'digital-marketing', 'Digital Marketing', 'SEO, social media and paid ads.', 'megaphone', 3) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.categories (id, slug, name, description, icon, sort_order) values ('48fc182b-40cc-5541-a83b-d5986626b919', 'excel', 'Excel', 'Excel for finance and business.', 'table', 4) on conflict (slug) do update set name = excluded.name, description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('f7bfc67a-5d57-5525-a54f-099e29b12d20', 'stock-market-program', 'Stock Market Program', 'Understand how markets work, read charts, analyse companies and manage risk with discipline.', 'A complete, practical introduction to the Indian stock market. You start with how NSE, BSE, brokers and demat accounts fit together, then learn to read price charts and indicators, analyse a company''s financial statements, value a business and build a risk-managed portfolio. Every module ends with practice, and the program closes with a capstone where you build and defend your own mock portfolio.', (select id from public.categories where slug = 'stock-market'), '/thumbnails/stock-market-program.svg', 399900, 'beginner', 'English', 554, array['Explain how Indian exchanges, brokers, depositories and SEBI work together', 'Read candlestick charts and identify trends, support and resistance', 'Use moving averages, RSI and MACD as part of a disciplined checklist', 'Analyse a company''s P&L, balance sheet and cash flow statement', 'Value a business with ratios and an introductory DCF', 'Size positions, set stop-losses and avoid common behavioural mistakes']::text[], array['No prior finance knowledge needed', 'A laptop or phone and an internet connection']::text[], '[{"question":"Is this program for complete beginners?","answer":"Yes. We start from how the market works and build up step by step. Commerce, engineering and arts students all take it."},{"question":"Will you give stock tips or trading calls?","answer":"No. This is an education program. We teach you how to analyse markets and companies yourself. Nothing in the program is investment advice."},{"question":"Do I need a demat account?","answer":"No. You can complete the whole program, including the capstone, without opening a demat account. We explain how to open one if you decide to invest later."},{"question":"How much time does it take?","answer":"Most students finish in about 8 weeks at 4–5 hours a week. It''s self-paced, so you can go faster or slower."},{"question":"Will I get a certificate?","answer":"Yes. When you finish every mandatory lesson, submit the required assignments and pass the quizzes, you receive a SkillSpring certificate with a unique ID that anyone can verify online."},{"question":"How long can I access the program?","answer":"Your access doesn''t expire. Watch lessons at your own pace and come back to them whenever you need a refresher."},{"question":"How do I pay?","answer":"Pay securely with UPI, debit or credit card, net banking or wallets through Razorpay. You get access as soon as your payment is confirmed."},{"question":"Can I get a refund?","answer":"Yes, within 7 days of purchase if you have completed less than 25% of the program. See our refund policy for the full conditions."}]'::jsonb, 'published', 'owned', 'Original SkillSpring content. Untick Demo once lesson videos are uploaded.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs, rights_status = excluded.rights_status, rights_notes = excluded.rights_notes;
insert into public.course_modules (id, course_id, title, position) values ('3efab387-457a-51df-acd9-daacbbaa74c0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'How the Indian stock market works', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3f067a39-876c-5458-ae8b-9380a2f92c21', '3efab387-457a-51df-acd9-daacbbaa74c0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Exchanges, SEBI and depositories', 'video', '> **Coming soon.** The video for "Exchanges, SEBI and depositories" is being recorded and will appear here when the program opens for enrolment.', 14, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('89296452-c0eb-5a78-adaf-8702c7de0e58', '3efab387-457a-51df-acd9-daacbbaa74c0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'How a trade happens: brokers, demat and settlement', 'video', '> **Coming soon.** The video for "How a trade happens: brokers, demat and settlement" is being recorded and will appear here when the program opens for enrolment.', 16, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('ca008f55-6f35-5dc5-a7ad-1abed8e1389d', '3efab387-457a-51df-acd9-daacbbaa74c0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Order types: market, limit and stop-loss', 'video', '> **Coming soon.** The video for "Order types: market, limit and stop-loss" is being recorded and will appear here when the program opens for enrolment.', 12, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('93090811-2bc2-515a-a54f-d16887c9dd11', '3efab387-457a-51df-acd9-daacbbaa74c0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Market basics quiz', 'quiz', '> **Coming soon.** The video for "Market basics quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('aa92c944-1ea7-5687-a875-e4cd0081c55d', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', '93090811-2bc2-515a-a54f-d16887c9dd11', 'Market basics quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('f2a68319-7107-565a-aead-97065f3ef08e', 'aa92c944-1ea7-5687-a875-e4cd0081c55d', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('11f47b09-1d45-5c8e-a89b-7fc862016b92', 'aa92c944-1ea7-5687-a875-e4cd0081c55d', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('e3d54759-f0c1-52e7-a26d-72501b33d4c3', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Reading price charts', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('49835a06-2032-5ab9-a4b6-87c39de1f9db', 'e3d54759-f0c1-52e7-a26d-72501b33d4c3', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Candlesticks and timeframes', 'video', '> **Coming soon.** The video for "Candlesticks and timeframes" is being recorded and will appear here when the program opens for enrolment.', 15, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3d0a8ffb-d31f-5e79-a490-ce2592311cef', 'e3d54759-f0c1-52e7-a26d-72501b33d4c3', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Trends, support and resistance', 'video', '> **Coming soon.** The video for "Trends, support and resistance" is being recorded and will appear here when the program opens for enrolment.', 18, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('797be2cc-56aa-5cc5-a003-3eaa800b1827', 'e3d54759-f0c1-52e7-a26d-72501b33d4c3', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'What volume tells you', 'video', '> **Coming soon.** The video for "What volume tells you" is being recorded and will appear here when the program opens for enrolment.', 12, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('132983b3-1b60-565a-ae6e-61f458339744', 'e3d54759-f0c1-52e7-a26d-72501b33d4c3', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Annotate three real charts', 'assignment', '> **Coming soon.** The video for "Annotate three real charts" is being recorded and will appear here when the program opens for enrolment.', 45, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('8ae25703-8ff2-550c-adb0-4376f7cd9d15', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', '132983b3-1b60-565a-ae6e-61f458339744', 'Annotate three real charts', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('ae07ebbf-fda3-533d-a1dd-5ded54cc2eb0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Technical indicators', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('1b902ca0-9e98-5625-a31d-cfab93e67a71', 'ae07ebbf-fda3-533d-a1dd-5ded54cc2eb0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Moving averages', 'video', '> **Coming soon.** The video for "Moving averages" is being recorded and will appear here when the program opens for enrolment.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b6b7e7c7-5230-532b-a708-b95165def652', 'ae07ebbf-fda3-533d-a1dd-5ded54cc2eb0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'RSI and MACD', 'video', '> **Coming soon.** The video for "RSI and MACD" is being recorded and will appear here when the program opens for enrolment.', 16, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9dddca4d-189d-5506-a5fd-3b40cc7cb143', 'ae07ebbf-fda3-533d-a1dd-5ded54cc2eb0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Building a trading checklist', 'video', '> **Coming soon.** The video for "Building a trading checklist" is being recorded and will appear here when the program opens for enrolment.', 12, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('08c48fb3-9888-5d63-a6da-afa58c8e7ce4', 'ae07ebbf-fda3-533d-a1dd-5ded54cc2eb0', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Indicators quiz', 'quiz', '> **Coming soon.** The video for "Indicators quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('f9e9dabb-b7f6-530c-a334-f63fe1dc1766', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', '08c48fb3-9888-5d63-a6da-afa58c8e7ce4', 'Indicators quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('6cc98112-28ab-5c1f-a213-91ba634aa509', 'f9e9dabb-b7f6-530c-a334-f63fe1dc1766', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('b2657800-3aff-5a3e-a5d4-91303140a8b9', 'f9e9dabb-b7f6-530c-a334-f63fe1dc1766', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('d63ea16d-0aa2-5949-abf5-b53568eab4d1', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Fundamental analysis', 4) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('a0bdfae2-fb56-58c5-a41f-e2f83c1599db', 'd63ea16d-0aa2-5949-abf5-b53568eab4d1', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Reading the P&L, balance sheet and cash flow', 'video', '> **Coming soon.** The video for "Reading the P&L, balance sheet and cash flow" is being recorded and will appear here when the program opens for enrolment.', 22, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('d6bfe41a-6ecc-5f2a-a7dd-f2c2960a9b03', 'd63ea16d-0aa2-5949-abf5-b53568eab4d1', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Key ratios: P/E, ROE and debt-to-equity', 'video', '> **Coming soon.** The video for "Key ratios: P/E, ROE and debt-to-equity" is being recorded and will appear here when the program opens for enrolment.', 18, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('dac83db1-9e91-5670-a3c5-183c80ebbda0', 'd63ea16d-0aa2-5949-abf5-b53568eab4d1', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Industry analysis and competitive moats', 'video', '> **Coming soon.** The video for "Industry analysis and competitive moats" is being recorded and will appear here when the program opens for enrolment.', 15, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('1f4594d4-9b06-5d9a-abff-a6ee6e9b04c9', 'd63ea16d-0aa2-5949-abf5-b53568eab4d1', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Ratio analysis workbook', 'pdf', '> **Coming soon.** The video for "Ratio analysis workbook" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('80f40f44-f754-5b0d-aefc-0e1efab9d43f', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Valuation and research', 5) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('5d8fffe6-a768-5846-a830-3e841d36637f', '80f40f44-f754-5b0d-aefc-0e1efab9d43f', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Relative valuation', 'video', '> **Coming soon.** The video for "Relative valuation" is being recorded and will appear here when the program opens for enrolment.', 16, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('95b1286b-45ed-5f72-acaf-4651fafcb3b0', '80f40f44-f754-5b0d-aefc-0e1efab9d43f', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Introduction to DCF valuation', 'video', '> **Coming soon.** The video for "Introduction to DCF valuation" is being recorded and will appear here when the program opens for enrolment.', 20, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('063a58ab-2a07-579c-adb9-a9589fee2182', '80f40f44-f754-5b0d-aefc-0e1efab9d43f', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Write a one-page stock research note', 'assignment', '> **Coming soon.** The video for "Write a one-page stock research note" is being recorded and will appear here when the program opens for enrolment.', 90, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('224ddb6c-d64e-55f1-a83a-03c34824e31f', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', '063a58ab-2a07-579c-adb9-a9589fee2182', 'Write a one-page stock research note', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('02093c93-de69-595b-ae65-3bfb9dc47396', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Risk, psychology and portfolio building', 6) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b86f5247-c39a-5a3a-a334-36616c189455', '02093c93-de69-595b-ae65-3bfb9dc47396', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Position sizing and stop-losses', 'video', '> **Coming soon.** The video for "Position sizing and stop-losses" is being recorded and will appear here when the program opens for enrolment.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('42a2d726-0031-5e62-a6d1-fbd0b80c13c3', '02093c93-de69-595b-ae65-3bfb9dc47396', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Diversification and asset allocation', 'video', '> **Coming soon.** The video for "Diversification and asset allocation" is being recorded and will appear here when the program opens for enrolment.', 13, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('7f992568-ec24-516d-ab55-8451487ab79a', '02093c93-de69-595b-ae65-3bfb9dc47396', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Trading psychology and common mistakes', 'video', '> **Coming soon.** The video for "Trading psychology and common mistakes" is being recorded and will appear here when the program opens for enrolment.', 12, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('6d2f7732-b2c8-53e4-a038-25b8a94490bf', '02093c93-de69-595b-ae65-3bfb9dc47396', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Capstone: build and justify a mock portfolio', 'assignment', '> **Coming soon.** The video for "Capstone: build and justify a mock portfolio" is being recorded and will appear here when the program opens for enrolment.', 120, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('564373f7-a901-5577-a943-a3ce537621a4', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', '6d2f7732-b2c8-53e4-a038-25b8a94490bf', 'Capstone: build and justify a mock portfolio', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('bbbce426-d5d6-5033-ab1b-0754a93aad46', '02093c93-de69-595b-ae65-3bfb9dc47396', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'Final assessment', 'quiz', '> **Coming soon.** The video for "Final assessment" is being recorded and will appear here when the program opens for enrolment.', 10, 5, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('daca320f-41b5-547c-a4ae-0787a9e1ca89', 'f7bfc67a-5d57-5525-a54f-099e29b12d20', 'bbbce426-d5d6-5033-ab1b-0754a93aad46', 'Final assessment', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('31091d3b-4b54-551a-a4c8-0d6b614a7e3a', 'daca320f-41b5-547c-a4ae-0787a9e1ca89', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('ba6394d2-4bf8-55a0-a244-267f33f7b0d1', 'daca320f-41b5-547c-a4ae-0787a9e1ca89', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'web-development-program', 'Web Design & Development Program', 'Design in Figma, build with HTML, CSS, JavaScript and React, and launch your own portfolio website.', 'Go from zero to a live portfolio website. You learn how the web works, write clean HTML and CSS, design layouts in Figma, add interactivity with JavaScript, build components in React and deploy your projects to the internet. You build something in every module, so by the end you have a portfolio of real work to show recruiters and clients.', (select id from public.categories where slug = 'web-development'), '/thumbnails/web-development-program.svg', 399900, 'beginner', 'English', 798, array['Build responsive web pages with semantic HTML and modern CSS', 'Create layouts with Flexbox and Grid that work on every screen size', 'Design landing pages and app screens in Figma', 'Write JavaScript that responds to users and fetches data from APIs', 'Build reusable components with React and style them with Tailwind CSS', 'Use Git and GitHub, and deploy websites on Vercel']::text[], array['No coding experience needed', 'A laptop (Windows, Mac or Linux)']::text[], '[{"question":"I''ve never coded before. Can I do this?","answer":"Yes. The program assumes no coding experience. Each concept is shown on screen step by step, and you practise it straight away."},{"question":"What will I have built by the end?","answer":"A profile page, a designed landing page, an interactive to-do app and a live portfolio website, all on your own GitHub account."},{"question":"Do I need a powerful laptop?","answer":"No. Any laptop that can run a modern browser and VS Code is enough. All the tools we use are free."},{"question":"Does it cover both design and development?","answer":"Yes. You learn UI design basics in Figma, then build those designs with HTML, CSS, JavaScript and React."},{"question":"How much time does it take?","answer":"About 10 weeks at 5–6 hours a week. It''s self-paced, so you can adjust it around college."},{"question":"Will I get a certificate?","answer":"Yes. When you finish every mandatory lesson, submit the required assignments and pass the quizzes, you receive a SkillSpring certificate with a unique ID that anyone can verify online."},{"question":"How long can I access the program?","answer":"Your access doesn''t expire. Watch lessons at your own pace and come back to them whenever you need a refresher."},{"question":"How do I pay?","answer":"Pay securely with UPI, debit or credit card, net banking or wallets through Razorpay. You get access as soon as your payment is confirmed."},{"question":"Can I get a refund?","answer":"Yes, within 7 days of purchase if you have completed less than 25% of the program. See our refund policy for the full conditions."}]'::jsonb, 'published', 'owned', 'Original SkillSpring content. Untick Demo once lesson videos are uploaded.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs, rights_status = excluded.rights_status, rights_notes = excluded.rights_notes;
insert into public.course_modules (id, course_id, title, position) values ('f92973a3-ad17-51f1-a1e1-6933d9b1dbca', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'How the web works', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f1660ec0-7301-5a98-a5a0-ffa9be16ca2b', 'f92973a3-ad17-51f1-a1e1-6933d9b1dbca', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'How websites work', 'video', '> **Coming soon.** The video for "How websites work" is being recorded and will appear here when the program opens for enrolment.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('599320c7-63f8-514e-ac54-d212890699ae', 'f92973a3-ad17-51f1-a1e1-6933d9b1dbca', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Setting up VS Code and your tools', 'video', '> **Coming soon.** The video for "Setting up VS Code and your tools" is being recorded and will appear here when the program opens for enrolment.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('38dc3072-e54d-5872-aaf3-614e41b25af8', 'f92973a3-ad17-51f1-a1e1-6933d9b1dbca', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Web basics quiz', 'quiz', '> **Coming soon.** The video for "Web basics quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('0b214d83-0676-522f-a4e6-e96a72cbf837', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', '38dc3072-e54d-5872-aaf3-614e41b25af8', 'Web basics quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('fbc80bd2-2795-5278-a086-7089be08ec01', '0b214d83-0676-522f-a4e6-e96a72cbf837', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('2288acea-71cc-544a-a172-c1352b7a0a45', '0b214d83-0676-522f-a4e6-e96a72cbf837', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('2c146c0b-f605-5639-a884-8bcbe918f863', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'HTML', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f58f2ed4-7412-5bc8-a790-3a6e6139814c', '2c146c0b-f605-5639-a884-8bcbe918f863', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'The structure of a web page', 'video', '> **Coming soon.** The video for "The structure of a web page" is being recorded and will appear here when the program opens for enrolment.', 16, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('119d1050-4226-545d-a335-79e13575ebba', '2c146c0b-f605-5639-a884-8bcbe918f863', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Forms, tables and media', 'video', '> **Coming soon.** The video for "Forms, tables and media" is being recorded and will appear here when the program opens for enrolment.', 18, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('30002ac5-45c8-5795-a516-dd58ad2f2655', '2c146c0b-f605-5639-a884-8bcbe918f863', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Semantic HTML and accessibility', 'video', '> **Coming soon.** The video for "Semantic HTML and accessibility" is being recorded and will appear here when the program opens for enrolment.', 14, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8bbdb7e2-bb76-5afe-a6c4-e8d0133c90a2', '2c146c0b-f605-5639-a884-8bcbe918f863', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Build your profile page', 'assignment', '> **Coming soon.** The video for "Build your profile page" is being recorded and will appear here when the program opens for enrolment.', 60, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('085bc58b-dbff-5507-ae3c-93a1b7231924', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', '8bbdb7e2-bb76-5afe-a6c4-e8d0133c90a2', 'Build your profile page', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('b571cde3-b88a-5dc7-af0f-4335dc7903c8', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'CSS and responsive design', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b4c3d330-7101-5253-a886-1abc11c6e31f', 'b571cde3-b88a-5dc7-af0f-4335dc7903c8', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Selectors, colours and the box model', 'video', '> **Coming soon.** The video for "Selectors, colours and the box model" is being recorded and will appear here when the program opens for enrolment.', 18, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('24cc5f16-d68e-5a86-a524-7ff69715ba06', 'b571cde3-b88a-5dc7-af0f-4335dc7903c8', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Typography and spacing', 'video', '> **Coming soon.** The video for "Typography and spacing" is being recorded and will appear here when the program opens for enrolment.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9d217324-c0a2-552c-a3cb-4a673b91bd0a', 'b571cde3-b88a-5dc7-af0f-4335dc7903c8', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Flexbox and Grid', 'video', '> **Coming soon.** The video for "Flexbox and Grid" is being recorded and will appear here when the program opens for enrolment.', 22, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('4dfba388-8d2e-5184-ae51-9c3730d81760', 'b571cde3-b88a-5dc7-af0f-4335dc7903c8', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Responsive design for mobile', 'video', '> **Coming soon.** The video for "Responsive design for mobile" is being recorded and will appear here when the program opens for enrolment.', 16, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('60937435-3381-5075-a0ca-412a3d317f28', 'b571cde3-b88a-5dc7-af0f-4335dc7903c8', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'CSS quiz', 'quiz', '> **Coming soon.** The video for "CSS quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 5, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('b596c63e-7f68-5ed0-a56a-5279efcdc4d1', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', '60937435-3381-5075-a0ca-412a3d317f28', 'CSS quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('829b3486-373c-5604-a62a-9ec1ddde56f1', 'b596c63e-7f68-5ed0-a56a-5279efcdc4d1', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('74aa6115-a5f7-5e32-a004-c2a449df2bf8', 'b596c63e-7f68-5ed0-a56a-5279efcdc4d1', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('024e533c-a24d-5219-a623-976d968ddde3', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'UI design with Figma', 4) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('364974da-1635-591c-af35-55aed8a52ab9', '024e533c-a24d-5219-a623-976d968ddde3', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'UI design basics', 'video', '> **Coming soon.** The video for "UI design basics" is being recorded and will appear here when the program opens for enrolment.', 15, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('4e8ca969-fbfd-5e78-a6e4-778619ebde13', '024e533c-a24d-5219-a623-976d968ddde3', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'From wireframe to mockup in Figma', 'video', '> **Coming soon.** The video for "From wireframe to mockup in Figma" is being recorded and will appear here when the program opens for enrolment.', 20, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('6a34de35-9d65-5133-a1ca-24dcb2cbebc9', '024e533c-a24d-5219-a623-976d968ddde3', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Design a landing page', 'assignment', '> **Coming soon.** The video for "Design a landing page" is being recorded and will appear here when the program opens for enrolment.', 90, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('59d61413-8402-5df9-aed4-5e5b6f9b31c9', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', '6a34de35-9d65-5133-a1ca-24dcb2cbebc9', 'Design a landing page', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('57ea800c-e0fd-50a0-a525-4fea0dcbdb8f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'JavaScript', 5) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('a5b29508-151d-5a19-a586-9e142814e47e', '57ea800c-e0fd-50a0-a525-4fea0dcbdb8f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Variables, functions and logic', 'video', '> **Coming soon.** The video for "Variables, functions and logic" is being recorded and will appear here when the program opens for enrolment.', 22, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('bb99880b-8fd5-5b31-a9a8-3a8fe7bee69b', '57ea800c-e0fd-50a0-a525-4fea0dcbdb8f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'The DOM and events', 'video', '> **Coming soon.** The video for "The DOM and events" is being recorded and will appear here when the program opens for enrolment.', 20, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('adc53e58-0a70-5744-a40a-ddfa5bf25cd4', '57ea800c-e0fd-50a0-a525-4fea0dcbdb8f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Fetching data from APIs', 'video', '> **Coming soon.** The video for "Fetching data from APIs" is being recorded and will appear here when the program opens for enrolment.', 18, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('2b61dd68-b234-5ad6-a6a2-5964b6747267', '57ea800c-e0fd-50a0-a525-4fea0dcbdb8f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Build an interactive to-do app', 'assignment', '> **Coming soon.** The video for "Build an interactive to-do app" is being recorded and will appear here when the program opens for enrolment.', 120, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('0bf14b12-9c70-5864-a1f8-54f5243950a6', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', '2b61dd68-b234-5ad6-a6a2-5964b6747267', 'Build an interactive to-do app', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('4bde04f8-7748-5520-ad54-be506c84380a', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'React and modern tools', 6) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b38bf4d8-6111-55ed-a0fb-86aa4c2da85f', '4bde04f8-7748-5520-ad54-be506c84380a', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Components and props', 'video', '> **Coming soon.** The video for "Components and props" is being recorded and will appear here when the program opens for enrolment.', 18, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('5eaca1c5-a11a-5447-aa80-27bd52f353ce', '4bde04f8-7748-5520-ad54-be506c84380a', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'State and hooks', 'video', '> **Coming soon.** The video for "State and hooks" is being recorded and will appear here when the program opens for enrolment.', 20, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('60580e8a-1377-552f-a5a5-979e3d26eba9', '4bde04f8-7748-5520-ad54-be506c84380a', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Styling with Tailwind CSS', 'video', '> **Coming soon.** The video for "Styling with Tailwind CSS" is being recorded and will appear here when the program opens for enrolment.', 15, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('664822d8-d0dd-5762-a667-9834fa97c68c', '4bde04f8-7748-5520-ad54-be506c84380a', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'React quiz', 'quiz', '> **Coming soon.** The video for "React quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('dfd3874f-a293-52a4-a144-95475cb558c8', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', '664822d8-d0dd-5762-a667-9834fa97c68c', 'React quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('e3d7ba4b-8a6f-5c02-acb7-0f978c6aa5ee', 'dfd3874f-a293-52a4-a144-95475cb558c8', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('64dbd1fe-844b-56aa-a7aa-c5babe24702d', 'dfd3874f-a293-52a4-a144-95475cb558c8', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('92efe55c-d760-549b-aaba-7220e66b848f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Ship it', 7) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('c2d2aac8-9def-5c3a-a548-3971abf7480e', '92efe55c-d760-549b-aaba-7220e66b848f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Git and GitHub', 'video', '> **Coming soon.** The video for "Git and GitHub" is being recorded and will appear here when the program opens for enrolment.', 16, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('e0e47d79-44c4-57ba-afc2-d76c886fdb43', '92efe55c-d760-549b-aaba-7220e66b848f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Deploying on Vercel', 'video', '> **Coming soon.** The video for "Deploying on Vercel" is being recorded and will appear here when the program opens for enrolment.', 10, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('1c757cba-144a-5744-a61c-b6c01d5641e4', '92efe55c-d760-549b-aaba-7220e66b848f', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', 'Capstone: launch your portfolio website', 'assignment', '> **Coming soon.** The video for "Capstone: launch your portfolio website" is being recorded and will appear here when the program opens for enrolment.', 180, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('9823b6ef-fd54-570c-aadc-78b90094822c', '52ce63bf-ef26-5ca4-aa27-4dfdab366391', '1c757cba-144a-5744-a61c-b6c01d5641e4', 'Capstone: launch your portfolio website', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'digital-marketing-program', 'Digital Marketing Program', 'Plan campaigns, grow on social media, rank on Google and measure what works.', 'Learn the skills brands hire for. You start with marketing funnels and customer personas, then learn SEO and content, social media and short-form video, Google and Meta ads, email and WhatsApp marketing, and analytics. You finish by building a complete campaign plan you can show in interviews or use for a real business.', (select id from public.categories where slug = 'digital-marketing'), '/thumbnails/digital-marketing-program.svg', 299900, 'beginner', 'English', 562, array['Map a customer journey and plan a full marketing funnel', 'Do keyword research and optimise content to rank on Google', 'Plan social media content and short-form videos that people engage with', 'Set up and budget Google Ads and Meta Ads campaigns', 'Use email, WhatsApp and automation to nurture customers', 'Track results in Google Analytics 4 and report ROI']::text[], array['No prior marketing experience needed', 'A laptop or phone and an internet connection']::text[], '[{"question":"Do I need to spend money on ads to complete the program?","answer":"No. We show you how ad platforms work using their own tools and demo accounts. You don''t need to run paid campaigns to finish."},{"question":"Is this useful for freelancing or my own business?","answer":"Yes. The capstone is a complete campaign plan you can adapt for a real business or show to freelance clients."},{"question":"Which tools will I learn?","answer":"Google Search Console, Google Ads, Meta Ads Manager, Google Analytics 4, Canva and common email and automation tools."},{"question":"How much time does it take?","answer":"About 6 weeks at 4–5 hours a week, at your own pace."},{"question":"Will I get a certificate?","answer":"Yes. When you finish every mandatory lesson, submit the required assignments and pass the quizzes, you receive a SkillSpring certificate with a unique ID that anyone can verify online."},{"question":"How long can I access the program?","answer":"Your access doesn''t expire. Watch lessons at your own pace and come back to them whenever you need a refresher."},{"question":"How do I pay?","answer":"Pay securely with UPI, debit or credit card, net banking or wallets through Razorpay. You get access as soon as your payment is confirmed."},{"question":"Can I get a refund?","answer":"Yes, within 7 days of purchase if you have completed less than 25% of the program. See our refund policy for the full conditions."}]'::jsonb, 'published', 'owned', 'Original SkillSpring content. Untick Demo once lesson videos are uploaded.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs, rights_status = excluded.rights_status, rights_notes = excluded.rights_notes;
insert into public.course_modules (id, course_id, title, position) values ('3c59b185-8293-54cd-a9eb-65fed535153d', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Marketing foundations', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9fbbe656-2bc3-5c87-aad8-c81e9305d9cc', '3c59b185-8293-54cd-a9eb-65fed535153d', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'The digital marketing funnel', 'video', '> **Coming soon.** The video for "The digital marketing funnel" is being recorded and will appear here when the program opens for enrolment.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9049f4d5-a6d9-5bc3-a8fe-3f8e67acca0b', '3c59b185-8293-54cd-a9eb-65fed535153d', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Customer personas and journeys', 'video', '> **Coming soon.** The video for "Customer personas and journeys" is being recorded and will appear here when the program opens for enrolment.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('649a1cd4-9fe1-5ca1-a145-1c23e1bea964', '3c59b185-8293-54cd-a9eb-65fed535153d', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Foundations quiz', 'quiz', '> **Coming soon.** The video for "Foundations quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('913375b0-37c3-597c-a7d6-8ee106e88c6a', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', '649a1cd4-9fe1-5ca1-a145-1c23e1bea964', 'Foundations quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('d722f039-906a-56e9-adcc-1f548425aa6b', '913375b0-37c3-597c-a7d6-8ee106e88c6a', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('7540d0cd-247f-5153-a26f-5497e0a14333', '913375b0-37c3-597c-a7d6-8ee106e88c6a', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('4e467fba-d57c-5172-afa2-4d8bc9aebf2f', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'SEO and content', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('77f7a44c-ccf0-5528-a273-6eb81770a4e0', '4e467fba-d57c-5172-afa2-4d8bc9aebf2f', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'How search engines rank pages', 'video', '> **Coming soon.** The video for "How search engines rank pages" is being recorded and will appear here when the program opens for enrolment.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('a81f4038-8b74-5ec1-a637-9c531d6287a9', '4e467fba-d57c-5172-afa2-4d8bc9aebf2f', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Keyword research', 'video', '> **Coming soon.** The video for "Keyword research" is being recorded and will appear here when the program opens for enrolment.', 16, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9bd46ceb-e38c-534b-ac65-516ac4595aaa', '4e467fba-d57c-5172-afa2-4d8bc9aebf2f', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'On-page SEO and content writing', 'video', '> **Coming soon.** The video for "On-page SEO and content writing" is being recorded and will appear here when the program opens for enrolment.', 18, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('98e428b5-fe62-5179-acf6-edcdddad8509', '4e467fba-d57c-5172-afa2-4d8bc9aebf2f', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Optimise a blog post', 'assignment', '> **Coming soon.** The video for "Optimise a blog post" is being recorded and will appear here when the program opens for enrolment.', 60, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('a8308169-b0f5-553a-aee1-d172dcfe4e96', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', '98e428b5-fe62-5179-acf6-edcdddad8509', 'Optimise a blog post', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('3b25ee45-6c79-56eb-ad17-f1d8eaae5250', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Social media marketing', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('850e7b45-7467-55a0-ace8-2d685ec99aee', '3b25ee45-6c79-56eb-ad17-f1d8eaae5250', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Choosing platforms: Instagram, LinkedIn, YouTube', 'video', '> **Coming soon.** The video for "Choosing platforms: Instagram, LinkedIn, YouTube" is being recorded and will appear here when the program opens for enrolment.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('a11b2096-d3b8-5ee1-a5a4-7138303f15fd', '3b25ee45-6c79-56eb-ad17-f1d8eaae5250', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Content pillars and calendars', 'video', '> **Coming soon.** The video for "Content pillars and calendars" is being recorded and will appear here when the program opens for enrolment.', 12, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('8b77baa6-706c-5baf-ae26-942d35d369e8', '3b25ee45-6c79-56eb-ad17-f1d8eaae5250', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Short-form video and reels', 'video', '> **Coming soon.** The video for "Short-form video and reels" is being recorded and will appear here when the program opens for enrolment.', 16, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3848a943-b41c-5e65-a979-0861a2078408', '3b25ee45-6c79-56eb-ad17-f1d8eaae5250', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Create a 30-day content calendar', 'assignment', '> **Coming soon.** The video for "Create a 30-day content calendar" is being recorded and will appear here when the program opens for enrolment.', 90, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('7470f9e7-ffd5-5725-ab63-c935e2fd8695', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', '3848a943-b41c-5e65-a979-0861a2078408', 'Create a 30-day content calendar', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('aabcb327-b161-525f-a226-76cc361b256e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Performance marketing', 4) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('68eaa73e-80bc-5365-a069-ac697c774e08', 'aabcb327-b161-525f-a226-76cc361b256e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Google Ads basics', 'video', '> **Coming soon.** The video for "Google Ads basics" is being recorded and will appear here when the program opens for enrolment.', 20, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('caf9606b-76ee-535c-a22f-c8211b8a554e', 'aabcb327-b161-525f-a226-76cc361b256e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Meta Ads basics', 'video', '> **Coming soon.** The video for "Meta Ads basics" is being recorded and will appear here when the program opens for enrolment.', 20, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('a30c59a3-c5f3-57e3-aed6-c7f3cc2a2214', 'aabcb327-b161-525f-a226-76cc361b256e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Budgets, bidding and targeting', 'video', '> **Coming soon.** The video for "Budgets, bidding and targeting" is being recorded and will appear here when the program opens for enrolment.', 15, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('7cb294a9-a7f8-5d33-a1e3-cf83c97bdfcf', 'aabcb327-b161-525f-a226-76cc361b256e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Ads quiz', 'quiz', '> **Coming soon.** The video for "Ads quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('f643d08b-206d-5c5d-a403-368867952157', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', '7cb294a9-a7f8-5d33-a1e3-cf83c97bdfcf', 'Ads quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('6c554140-4c7c-53df-a097-7c9f3264aa73', 'f643d08b-206d-5c5d-a403-368867952157', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('2f497c31-6240-5d02-a047-4caa1be50f2f', 'f643d08b-206d-5c5d-a403-368867952157', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('cd4d98f9-3bf5-596d-a4dd-c4e39695fa3e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Email, WhatsApp and automation', 5) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('795a0e36-8b00-58d5-ad04-a608b93792cb', 'cd4d98f9-3bf5-596d-a4dd-c4e39695fa3e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Email marketing and newsletters', 'video', '> **Coming soon.** The video for "Email marketing and newsletters" is being recorded and will appear here when the program opens for enrolment.', 15, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('6204a789-4f73-5d7c-aee5-b4f732308d10', 'cd4d98f9-3bf5-596d-a4dd-c4e39695fa3e', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'WhatsApp marketing and automation tools', 'video', '> **Coming soon.** The video for "WhatsApp marketing and automation tools" is being recorded and will appear here when the program opens for enrolment.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('eba4556a-d079-59b5-a60d-d215193c5a6b', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Analytics and growth', 6) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('51b49245-53d2-512b-afbd-80f3dbee5e24', 'eba4556a-d079-59b5-a60d-d215193c5a6b', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Google Analytics 4 basics', 'video', '> **Coming soon.** The video for "Google Analytics 4 basics" is being recorded and will appear here when the program opens for enrolment.', 18, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('66fc5633-f1cd-5a6c-a040-89718c36da89', 'eba4556a-d079-59b5-a60d-d215193c5a6b', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Measuring ROI and KPIs', 'video', '> **Coming soon.** The video for "Measuring ROI and KPIs" is being recorded and will appear here when the program opens for enrolment.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('59292308-825e-54f0-ae3b-5348178dd909', 'eba4556a-d079-59b5-a60d-d215193c5a6b', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Capstone: plan a complete campaign', 'assignment', '> **Coming soon.** The video for "Capstone: plan a complete campaign" is being recorded and will appear here when the program opens for enrolment.', 150, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('9dde3c8c-590d-5052-aa51-24d7bc5adf80', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', '59292308-825e-54f0-ae3b-5348178dd909', 'Capstone: plan a complete campaign', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('ec6055ee-9050-5111-ae16-1f8479761031', 'eba4556a-d079-59b5-a60d-d215193c5a6b', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'Final assessment', 'quiz', '> **Coming soon.** The video for "Final assessment" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('b8c3e1ef-eb64-52a9-a9ab-6b89b2466113', 'c06c3fc6-a49a-5533-ad0b-3db1085d0228', 'ec6055ee-9050-5111-ae16-1f8479761031', 'Final assessment', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('318a5a08-4e14-5189-a3b3-1a040e92966e', 'b8c3e1ef-eb64-52a9-a9ab-6b89b2466113', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('0d2217d0-467a-5d97-acf1-db07ce2745ec', 'b8c3e1ef-eb64-52a9-a9ab-6b89b2466113', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.courses (id, slug, title, subtitle, description, category_id, thumbnail_url, price_paise, level, language, duration_minutes, learning_outcomes, requirements, faqs, status, rights_status, rights_notes, is_demo, published_at)
values ('f4f0fea0-5586-596a-a83d-06ebb28e274d', 'excel-program', 'Excel for Finance & Business', 'Formulas, pivot tables, financial functions and dashboards, the Excel skills employers test for.', 'Become the person in the team who''s fast and accurate in Excel. You learn the formulas that matter, including XLOOKUP and dynamic arrays, analyse data with pivot tables, use financial functions like NPV, IRR and PMT, and build clean MIS dashboards. Every lesson uses business and finance examples, with practice workbooks to download.', (select id from public.categories where slug = 'excel'), '/thumbnails/excel-program.svg', 199900, 'beginner', 'English', 398, array['Work quickly with tables, formatting and keyboard shortcuts', 'Use IF, XLOOKUP, text and date functions confidently', 'Analyse data with pivot tables and dynamic arrays', 'Apply NPV, IRR and PMT and build an EMI calculator', 'Build an MIS dashboard with charts that communicate clearly', 'Automate repetitive work with Power Query and basic macros']::text[], array['Basic computer skills', 'Microsoft Excel 2021 or Microsoft 365 (recommended)']::text[], '[{"question":"Which version of Excel do I need?","answer":"Excel 2021 or Microsoft 365 is recommended because some lessons use XLOOKUP and dynamic arrays. Most other lessons also work in Excel 2016 and 2019."},{"question":"Is this only for commerce and finance students?","answer":"No. The examples are from finance and business, but the skills apply to any role that works with data, including operations, sales and HR."},{"question":"Do I get practice files?","answer":"Yes. Most lessons come with a downloadable workbook so you can practise as you watch."},{"question":"How much time does it take?","answer":"About 4 weeks at 3–4 hours a week, at your own pace."},{"question":"Will I get a certificate?","answer":"Yes. When you finish every mandatory lesson, submit the required assignments and pass the quizzes, you receive a SkillSpring certificate with a unique ID that anyone can verify online."},{"question":"How long can I access the program?","answer":"Your access doesn''t expire. Watch lessons at your own pace and come back to them whenever you need a refresher."},{"question":"How do I pay?","answer":"Pay securely with UPI, debit or credit card, net banking or wallets through Razorpay. You get access as soon as your payment is confirmed."},{"question":"Can I get a refund?","answer":"Yes, within 7 days of purchase if you have completed less than 25% of the program. See our refund policy for the full conditions."}]'::jsonb, 'published', 'owned', 'Original SkillSpring content. Untick Demo once lesson videos are uploaded.', true, now())
on conflict (slug) do update set title = excluded.title, subtitle = excluded.subtitle, description = excluded.description, category_id = excluded.category_id, thumbnail_url = excluded.thumbnail_url, price_paise = excluded.price_paise, level = excluded.level, duration_minutes = excluded.duration_minutes, learning_outcomes = excluded.learning_outcomes, requirements = excluded.requirements, faqs = excluded.faqs, rights_status = excluded.rights_status, rights_notes = excluded.rights_notes;
insert into public.course_modules (id, course_id, title, position) values ('edfbe34d-0db1-5a07-ad4b-19f4fc07861b', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Excel foundations', 1) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3a9e04ed-90b2-5ab1-a874-5998f5a7da30', 'edfbe34d-0db1-5a07-ad4b-19f4fc07861b', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Navigating Excel like a pro', 'video', '> **Coming soon.** The video for "Navigating Excel like a pro" is being recorded and will appear here when the program opens for enrolment.', 12, 1, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('03b1d9f1-0cab-5df5-ad24-6df0c9d29f63', 'edfbe34d-0db1-5a07-ad4b-19f4fc07861b', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Formatting, tables and shortcuts', 'video', '> **Coming soon.** The video for "Formatting, tables and shortcuts" is being recorded and will appear here when the program opens for enrolment.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('eb64d821-1e4f-5f23-a943-875867968167', 'edfbe34d-0db1-5a07-ad4b-19f4fc07861b', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Foundations quiz', 'quiz', '> **Coming soon.** The video for "Foundations quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('804eb100-fe9b-5213-a344-c9343eac4a32', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'eb64d821-1e4f-5f23-a943-875867968167', 'Foundations quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('3344671a-94cd-592c-abe5-832ae4df26e1', '804eb100-fe9b-5213-a344-c9343eac4a32', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('aa1c35b5-196d-5286-aba6-4dbf75094a06', '804eb100-fe9b-5213-a344-c9343eac4a32', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('0a70c56e-67c5-59a1-a735-4d82bdee84b9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Essential formulas', 2) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('d6e520c1-55d4-59c6-ab29-dafaf3d01158', '0a70c56e-67c5-59a1-a735-4d82bdee84b9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Logical functions: IF, AND and OR', 'video', '> **Coming soon.** The video for "Logical functions: IF, AND and OR" is being recorded and will appear here when the program opens for enrolment.', 14, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('290d2231-4e0e-5a82-ab8b-1b697a17540e', '0a70c56e-67c5-59a1-a735-4d82bdee84b9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Lookups that don''t break: XLOOKUP', 'video', '> **Coming soon.** The video for "Lookups that don''t break: XLOOKUP" is being recorded and will appear here when the program opens for enrolment.', 4, 2, true, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('c2717e87-2e82-5712-aede-075bb3ddaafa', '0a70c56e-67c5-59a1-a735-4d82bdee84b9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Text and date functions', 'video', '> **Coming soon.** The video for "Text and date functions" is being recorded and will appear here when the program opens for enrolment.', 15, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('29f35212-4d05-5a5d-ab75-db3fd54c0915', '0a70c56e-67c5-59a1-a735-4d82bdee84b9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Clean a messy dataset', 'assignment', '> **Coming soon.** The video for "Clean a messy dataset" is being recorded and will appear here when the program opens for enrolment.', 45, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('b91953a2-c2a2-55b9-aa7c-85b149281967', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', '29f35212-4d05-5a5d-ab75-db3fd54c0915', 'Clean a messy dataset', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('d4a31406-8f36-5340-a75c-65ce5b698be9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Data analysis', 3) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('5ef4ac01-4531-540f-a78d-5a477b17a229', 'd4a31406-8f36-5340-a75c-65ce5b698be9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Sorting, filtering and data validation', 'video', '> **Coming soon.** The video for "Sorting, filtering and data validation" is being recorded and will appear here when the program opens for enrolment.', 12, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('f282abdb-57d7-537a-a69d-8717b0826cc2', 'd4a31406-8f36-5340-a75c-65ce5b698be9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Pivot tables', 'video', '> **Coming soon.** The video for "Pivot tables" is being recorded and will appear here when the program opens for enrolment.', 20, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('1f4d7a1c-dd78-5db8-abc8-82fceb4d6252', 'd4a31406-8f36-5340-a75c-65ce5b698be9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Dynamic arrays: FILTER, SORT and UNIQUE', 'video', '> **Coming soon.** The video for "Dynamic arrays: FILTER, SORT and UNIQUE" is being recorded and will appear here when the program opens for enrolment.', 15, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('fe64196f-84d5-5a65-a085-52d5f099a42b', 'd4a31406-8f36-5340-a75c-65ce5b698be9', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Data analysis quiz', 'quiz', '> **Coming soon.** The video for "Data analysis quiz" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('17914940-5903-530b-a597-a7fd2cf5890f', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'fe64196f-84d5-5a65-a085-52d5f099a42b', 'Data analysis quiz', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('b5d4da0f-fc13-5bf0-a4d7-5ab55d36f92f', '17914940-5903-530b-a597-a7fd2cf5890f', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('5f258058-30b8-568c-a724-8cf4abf4487c', '17914940-5903-530b-a597-a7fd2cf5890f', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('5c168802-a599-5f15-aa66-49af8998ea5d', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Finance in Excel', 4) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b0d4c662-ba9a-5009-a01a-cf72f18dd9d7', '5c168802-a599-5f15-aa66-49af8998ea5d', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'NPV, IRR and PMT', 'video', '> **Coming soon.** The video for "NPV, IRR and PMT" is being recorded and will appear here when the program opens for enrolment.', 18, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('b25476cb-09c6-5216-af59-c231577b158f', '5c168802-a599-5f15-aa66-49af8998ea5d', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Building a loan and EMI calculator', 'video', '> **Coming soon.** The video for "Building a loan and EMI calculator" is being recorded and will appear here when the program opens for enrolment.', 16, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('242d8d4c-d0be-5940-aba7-f924e58be00c', '5c168802-a599-5f15-aa66-49af8998ea5d', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Budget vs actual analysis', 'video', '> **Coming soon.** The video for "Budget vs actual analysis" is being recorded and will appear here when the program opens for enrolment.', 14, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('3803ff7f-7a60-5ffe-acd1-b7b92fd08df5', '5c168802-a599-5f15-aa66-49af8998ea5d', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Financial functions workbook', 'pdf', '> **Coming soon.** The video for "Financial functions workbook" is being recorded and will appear here when the program opens for enrolment.', 10, 4, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.course_modules (id, course_id, title, position) values ('a100958b-9155-5514-ada3-645b5c5aefb3', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Dashboards and reporting', 5) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('484cb3cd-8925-55fb-a642-4121f5ab5b40', 'a100958b-9155-5514-ada3-645b5c5aefb3', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Charts that communicate', 'video', '> **Coming soon.** The video for "Charts that communicate" is being recorded and will appear here when the program opens for enrolment.', 15, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('c85a1a49-b7f6-57bf-ab61-583a43b66281', 'a100958b-9155-5514-ada3-645b5c5aefb3', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Building an MIS dashboard', 'video', '> **Coming soon.** The video for "Building an MIS dashboard" is being recorded and will appear here when the program opens for enrolment.', 22, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('1849fcb9-a802-5724-a913-ac47cdeed633', 'a100958b-9155-5514-ada3-645b5c5aefb3', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Build a monthly sales dashboard', 'assignment', '> **Coming soon.** The video for "Build a monthly sales dashboard" is being recorded and will appear here when the program opens for enrolment.', 90, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.assignments (id, course_id, lesson_id, title, instructions, is_mandatory) values ('7fa18cd8-86b7-5d74-a505-17b8d5586f9b', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', '1849fcb9-a802-5724-a913-ac47cdeed633', 'Build a monthly sales dashboard', 'The detailed brief for this assignment will be published when the program opens.', true) on conflict (id) do nothing;
insert into public.course_modules (id, course_id, title, position) values ('f59e5521-9851-5739-aac7-6af15a2dbeb4', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Productivity and automation', 6) on conflict (id) do update set title = excluded.title, position = excluded.position;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('9534a02c-d95c-55b2-ac45-89eba5512f99', 'f59e5521-9851-5739-aac7-6af15a2dbeb4', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Power Query basics', 'video', '> **Coming soon.** The video for "Power Query basics" is being recorded and will appear here when the program opens for enrolment.', 18, 1, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('5ad08db2-bcf8-5b4f-a022-e13bd4bb8b6e', 'f59e5521-9851-5739-aac7-6af15a2dbeb4', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Introduction to macros', 'video', '> **Coming soon.** The video for "Introduction to macros" is being recorded and will appear here when the program opens for enrolment.', 14, 2, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.lessons (id, module_id, course_id, title, type, content_md, duration_minutes, position, is_preview, is_mandatory) values ('99293632-a087-58b3-a187-cb192a3c164e', 'f59e5521-9851-5739-aac7-6af15a2dbeb4', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', 'Final assessment', 'quiz', '> **Coming soon.** The video for "Final assessment" is being recorded and will appear here when the program opens for enrolment.', 10, 3, false, true) on conflict (id) do update set title = excluded.title, type = excluded.type, duration_minutes = excluded.duration_minutes, position = excluded.position, is_preview = excluded.is_preview;
insert into public.quizzes (id, course_id, lesson_id, title, description, pass_pct, is_mandatory) values ('5cda0284-8764-505a-a7dc-10e0a1bf10f8', 'f4f0fea0-5586-596a-a83d-06ebb28e274d', '99293632-a087-58b3-a187-cb192a3c164e', 'Final assessment', 'Questions for this quiz are being finalised.', 60, true) on conflict (id) do nothing;
insert into public.quiz_questions (id, quiz_id, prompt, options, correct_index, explanation, position) values
  ('3334a36c-3025-59fb-ad9c-392a17e73806', '5cda0284-8764-505a-a7dc-10e0a1bf10f8', 'Sample question (replace in Admin before launch): what do you need to earn a SkillSpring certificate?', '["Only payment","Completing the program requirements","Watching one video","Nothing"]'::jsonb, 1, 'Certificates are issued only after verified completion.', 1),
  ('812e5a5e-6611-5f7c-a2bc-2813e01cf8e0', '5cda0284-8764-505a-a7dc-10e0a1bf10f8', 'Sample question (replace in Admin before launch): can you retake a quiz you did not pass?', '["Never","Yes, unless the quiz sets a maximum number of attempts","Only after paying again","Only on weekends"]'::jsonb, 1, 'Quizzes can be retaken unless a maximum number of attempts is set.', 2)
on conflict (id) do nothing;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('4ea99305-f990-54c8-a484-5e2151e09f63', 'stock-market-research-simulation', 'Stock Market Research Simulation', null, 'simulation', 'Work like an equity research analyst for four weeks: pick a listed company, study its filings and price history, and publish a research note with a clear view. Run by SkillSpring for learning purposes. This is not a job or an employer internship.', array['Study an annual report and recent filings', 'Analyse price charts and key ratios', 'Write a one-page research note', 'Present your thesis in a short recorded pitch']::text[], array['Financial statements', 'Technical analysis', 'Report writing']::text[], 'Open to all students. The Stock Market Program is recommended.', 'Online', 'remote', 4, false, 'Unpaid educational experience run by SkillSpring.', current_date + 45, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('551479f0-e4ac-5ccf-a7c0-7749827f5254', 'website-development-project', 'Website Development Project', null, 'project', 'Design and build a responsive website for a fictional small business from a real-style client brief, then deploy it live. Mentor feedback on submission. Educational project, not an employer placement.', array['Turn a client brief into a Figma mockup', 'Build the site with HTML, CSS and JavaScript or React', 'Make it responsive and accessible', 'Deploy it and share the live link']::text[], array['HTML & CSS', 'JavaScript', 'Figma']::text[], 'Open to all students. The Web Design & Development Program is recommended.', 'Online', 'remote', 4, false, 'Unpaid educational experience run by SkillSpring.', current_date + 60, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('ae1766d5-644b-52d2-ac3c-94c57d5c2a9b', 'digital-marketing-campaign-project', 'Digital Marketing Campaign Project', null, 'project', 'Plan a complete digital campaign for a fictional brand brief: audience research, channel mix, content calendar, budget and KPI dashboard. Educational project, not an employer placement.', array['Research the target audience', 'Design a channel mix and budget', 'Create a 4-week content calendar', 'Define KPIs and a reporting template']::text[], array['Digital marketing', 'Content planning', 'Analytics']::text[], 'Open to all students. The Digital Marketing Program is recommended.', 'Online', 'remote', 3, false, 'Unpaid educational experience run by SkillSpring.', current_date + 30, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
insert into public.internships (id, slug, title, employer_id, kind, description, responsibilities, skills, eligibility, location, work_mode, duration_weeks, is_paid, stipend_notes, deadline, positions, status, is_demo)
values ('fb1fb4be-8277-5da1-ad94-8bbf685c6f8a', 'excel-mis-dashboard-project', 'Excel MIS Dashboard Project', null, 'project', 'Turn a raw sales dataset into a clean monthly MIS report and dashboard, the way finance teams do every month. Educational project run by SkillSpring.', array['Clean and structure the raw data', 'Summarise it with pivot tables', 'Build a one-page dashboard', 'Write three insights for management']::text[], array['Excel', 'Pivot tables', 'Data visualisation']::text[], 'Open to all students. The Excel for Finance & Business program is recommended.', 'Online', 'remote', 2, false, 'Unpaid educational experience run by SkillSpring.', current_date + 40, null, 'open', true)
on conflict (slug) do update set title = excluded.title, description = excluded.description, responsibilities = excluded.responsibilities, skills = excluded.skills, eligibility = excluded.eligibility, deadline = excluded.deadline;
commit;
