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
