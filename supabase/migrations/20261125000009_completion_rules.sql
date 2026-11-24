-- =============================================================================
-- Proofwork — assignments count towards completion only once they pass
-- evaluation; certificate issuer follows the brand. Apply when going live.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6. Completion now counts an assignment only once it has passed evaluation
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
    where a.course_id = c.id and a.is_mandatory and s.status = 'approved';
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
    'quizzes', jsonb_build_object('ok', quiz_ok, 'passed', quiz_passed, 'required', quiz_total, 'min_pct', c.completion_min_quiz_pct)
  );
end $$;

-- Issuer name follows the brand.
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
  return query select cert.certificate_code, cert.student_name, cert.course_title, cert.issued_at, cert.status, cert.revoked_at, 'Proofwork'::text;
end $$;
