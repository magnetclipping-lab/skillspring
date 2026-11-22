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
