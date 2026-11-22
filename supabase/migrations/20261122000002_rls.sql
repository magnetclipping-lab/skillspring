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
