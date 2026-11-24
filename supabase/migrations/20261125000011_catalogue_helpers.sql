-- Public, answer-free assignment summaries for course pages (title, type and size only).
create or replace function public.get_course_assignment_summaries(p_course_id uuid)
returns table (id uuid, title text, kind text, summary text, estimated_minutes int)
language sql stable security definer set search_path = '' as $$
  select a.id, a.title, a.kind, a.summary, a.estimated_minutes
  from public.assignments a
  join public.courses c on c.id = a.course_id
  where a.course_id = p_course_id
    and (c.status = 'published' or private.can_view_content(c.id))
  order by a.position, a.created_at;
$$;
revoke all on function public.get_course_assignment_summaries(uuid) from public;
grant execute on function public.get_course_assignment_summaries(uuid) to anon, authenticated;

-- Course preview videos and posters: <course-id>/<file> in the public course-previews bucket.
drop policy if exists "previews_write" on storage.objects;
create policy "previews_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'course-previews' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));
drop policy if exists "previews_delete" on storage.objects;
create policy "previews_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'course-previews' and private.can_edit_course(private.try_uuid((storage.foldername(name))[1])));

-- Learners may remove their own unsubmitted uploads (used when a file fails the post-upload type check).
drop policy if exists "submissions_own_delete" on storage.objects;
create policy "submissions_own_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'assignment-submissions' and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.assignment_submissions s where s.file_path = name));

-- Quiz results: withhold explanations until passed (or out of attempts); include points.
create or replace function public.submit_quiz_attempt(p_quiz_id uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_user(); q public.quizzes%rowtype; used int;
  total_pts int := 0; got_pts int := 0; n_total int := 0; n_correct int := 0; pct int; passed boolean;
  results jsonb := '[]'::jsonb; qq public.quiz_questions; ok boolean;
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
  for qq in select * from public.quiz_questions where quiz_id = q.id order by position, created_at loop
    ok := private.grade_question(qq, p_answers -> qq.id::text);
    n_total := n_total + 1; total_pts := total_pts + qq.points;
    if ok then n_correct := n_correct + 1; got_pts := got_pts + qq.points; end if;
    results := results || jsonb_build_array(jsonb_build_object('question_id', qq.id, 'correct', ok, 'explanation', qq.explanation));
  end loop;
  if n_total = 0 then raise exception 'Quiz has no questions' using errcode = 'P0001'; end if;
  pct := round(got_pts * 100.0 / total_pts);
  passed := pct >= q.pass_pct;
  insert into public.quiz_attempts (quiz_id, user_id, answers, score_pct, passed) values (q.id, uid, p_answers, pct, passed);
  -- Explanations reveal answers: only return them once the learner has passed or used every attempt.
  if not passed and (q.max_attempts is null or used + 1 < q.max_attempts) then
    select coalesce(jsonb_agg(r - 'explanation'), '[]'::jsonb) into results from jsonb_array_elements(results) r;
  end if;
  return jsonb_build_object('score_pct', pct, 'passed', passed, 'correct', n_correct, 'total', n_total,
    'points', got_pts, 'max_points', total_pts, 'results', results);
end $$;

-- Admin: evaluate a pending submission now instead of waiting for the scheduled time.
create or replace function public.admin_evaluate_now(p_submission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.assignment_submissions%rowtype; uid uuid := private.require_user();
begin
  select * into s from public.assignment_submissions where id = p_submission_id;
  if not found then raise exception 'Submission not found'; end if;
  if not (private.is_admin() or private.owns_course(s.course_id)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.evaluation_jobs set run_at = now(), updated_at = now() where submission_id = s.id and status = 'queued';
  update public.assignment_submissions set evaluate_after = now() where id = s.id and eval_status = 'pending';
  perform private.audit(uid, 'evaluation.run_now', 'assignment_submission', s.id::text, '{}'::jsonb);
end $$;
revoke all on function public.admin_evaluate_now(uuid) from public, anon;
grant execute on function public.admin_evaluate_now(uuid) to authenticated;

-- Merchandising fields (featured, catalogue order) are set by admins only.
create or replace function private.guard_course_merchandising()
returns trigger language plpgsql set search_path = '' as $$
begin
  if private.is_privileged() then return new; end if;
  if tg_op = 'INSERT' then
    new.is_featured := false; new.sort_order := 0;
  elsif new.is_featured is distinct from old.is_featured or new.sort_order is distinct from old.sort_order then
    raise exception 'Only administrators can change featured status or catalogue order' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists guard_course_merchandising on public.courses;
create trigger guard_course_merchandising before insert or update on public.courses
  for each row execute function private.guard_course_merchandising();
