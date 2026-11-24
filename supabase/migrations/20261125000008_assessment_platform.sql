-- =============================================================================
-- Proofwork — catalogue fields, quiz question types, five assignment formats,
-- versioned submissions and a durable, delayed AI-evaluation queue.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Catalogue
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists is_public boolean not null default true,
  add column if not exists tagline text,
  add column if not exists accent text;

alter table public.courses
  add column if not exists preview_video_url text,
  add column if not exists preview_poster_url text,
  add column if not exists preview_duration_seconds int check (preview_duration_seconds is null or preview_duration_seconds between 1 and 600),
  add column if not exists projects_count int not null default 0 check (projects_count >= 0),
  add column if not exists is_featured boolean not null default false,
  add column if not exists sort_order int not null default 0;

-- Public preview videos (≤50 MB, uploaded straight from the admin browser with a signed URL)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('course-previews', 'course-previews', true, 52428800, array['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Assignment submissions and resources also accept CSV and PowerPoint
update storage.buckets set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'], file_size_limit = 20971520
where id = 'assignment-submissions';
update storage.buckets set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'application/zip', 'text/csv', 'text/plain',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation']
where id = 'course-resources';

-- ---------------------------------------------------------------------------
-- 2. Quiz question types
--   single / true_false / scenario : options = ["..",".."], correct_index
--   multi                           : options = [...],       correct = [indices]
--   match                           : options = {"left":[..],"right":[..]}, correct = [right index per left]
--   fill_blank                      : prompt uses ___ per blank, correct = [["accepted", ...], ...]
-- ---------------------------------------------------------------------------
alter table public.quiz_questions drop constraint if exists quiz_questions_check;
alter table public.quiz_questions drop constraint if exists quiz_questions_correct_index_check;
alter table public.quiz_questions drop constraint if exists quiz_questions_options_check;
alter table public.quiz_questions alter column correct_index drop not null;
alter table public.quiz_questions alter column options drop not null;
alter table public.quiz_questions
  add column if not exists qtype text not null default 'single'
    check (qtype in ('single', 'multi', 'true_false', 'match', 'fill_blank', 'scenario')),
  add column if not exists context text,
  add column if not exists correct jsonb,
  add column if not exists points int not null default 1 check (points between 1 and 20);
alter table public.quiz_questions add constraint quiz_questions_shape check (
  case qtype
    when 'multi' then jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 10 and jsonb_typeof(correct) = 'array'
    when 'match' then jsonb_typeof(options) = 'object' and jsonb_typeof(options -> 'left') = 'array' and jsonb_typeof(options -> 'right') = 'array'
                     and jsonb_typeof(correct) = 'array' and jsonb_array_length(correct) = jsonb_array_length(options -> 'left')
    when 'fill_blank' then jsonb_typeof(correct) = 'array' and jsonb_array_length(correct) >= 1
    else jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8
         and correct_index is not null and correct_index >= 0 and correct_index < jsonb_array_length(options)
  end
);

create or replace function public.get_quiz(p_quiz_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare q public.quizzes%rowtype; uid uuid := (select auth.uid()); used int; best int;
begin
  select * into q from public.quizzes where id = p_quiz_id;
  if not found or not private.can_view_content(q.course_id) then
    raise exception 'Quiz not available' using errcode = '42501';
  end if;
  select count(*), max(score_pct) into used, best from public.quiz_attempts where quiz_id = q.id and user_id = uid;
  -- Answers (correct_index / correct) are never returned to learners.
  return jsonb_build_object(
    'id', q.id, 'title', q.title, 'description', q.description, 'pass_pct', q.pass_pct,
    'max_attempts', q.max_attempts, 'attempts_used', used, 'best_score', best,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', qq.id, 'prompt', qq.prompt, 'qtype', qq.qtype, 'context', qq.context, 'points', qq.points,
        'options', qq.options,
        'blanks', case when qq.qtype = 'fill_blank' then jsonb_array_length(qq.correct) else null end
      ) order by qq.position, qq.created_at)
      from public.quiz_questions qq where qq.quiz_id = q.id), '[]'::jsonb)
  );
end $$;

create or replace function private.grade_question(qq public.quiz_questions, a jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare i int; ok boolean; given text; accepted jsonb;
begin
  if a is null or a = 'null'::jsonb then return false; end if;
  case qq.qtype
    when 'multi' then
      if jsonb_typeof(a) <> 'array' then return false; end if;
      return (select coalesce(array_agg(x::int order by x::int), '{}') from jsonb_array_elements_text(a) x where x ~ '^\d+$')
           = (select coalesce(array_agg(x::int order by x::int), '{}') from jsonb_array_elements_text(qq.correct) x);
    when 'match' then
      if jsonb_typeof(a) <> 'array' or jsonb_array_length(a) <> jsonb_array_length(qq.correct) then return false; end if;
      for i in 0 .. jsonb_array_length(qq.correct) - 1 loop
        if (a ->> i) is null or (a ->> i) <> (qq.correct ->> i) then return false; end if;
      end loop;
      return true;
    when 'fill_blank' then
      if jsonb_typeof(a) <> 'array' or jsonb_array_length(a) <> jsonb_array_length(qq.correct) then return false; end if;
      for i in 0 .. jsonb_array_length(qq.correct) - 1 loop
        given := lower(regexp_replace(trim(coalesce(a ->> i, '')), '\s+', ' ', 'g'));
        accepted := qq.correct -> i;
        if jsonb_typeof(accepted) <> 'array' then accepted := jsonb_build_array(accepted); end if;
        select exists (select 1 from jsonb_array_elements_text(accepted) x
                       where lower(regexp_replace(trim(x), '\s+', ' ', 'g')) = given) into ok;
        if not ok then return false; end if;
      end loop;
      return true;
    else
      return (a #>> '{}') ~ '^\d+$' and (a #>> '{}')::int = qq.correct_index;
  end case;
end $$;

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
  return jsonb_build_object('score_pct', pct, 'passed', passed, 'correct', n_correct, 'total', n_total, 'results', results);
end $$;

-- ---------------------------------------------------------------------------
-- 3. Assignment formats
--   file      : download a workbook/dataset, solve, upload (XLSX/CSV)
--   document  : download a Word brief, answer, upload DOCX
--   practical : real-world deliverable with evidence (files and/or links)
--   scenario  : professional situation with a written solution
--   (Interactive quizzes are the fifth format and live in public.quizzes.)
-- ---------------------------------------------------------------------------
alter table public.assignments
  add column if not exists kind text not null default 'practical' check (kind in ('file', 'document', 'practical', 'scenario')),
  add column if not exists module_id uuid references public.course_modules (id) on delete set null,
  add column if not exists summary text,
  add column if not exists scenario text,
  add column if not exists deliverables text,
  add column if not exists submission_requirements text,
  add column if not exists rubric jsonb not null default '[]'::jsonb check (jsonb_typeof(rubric) = 'array'),
  add column if not exists max_score int not null default 100 check (max_score between 1 and 1000),
  add column if not exists pass_pct int not null default 50 check (pass_pct between 0 and 100),
  add column if not exists template_path text,
  add column if not exists template_name text,
  add column if not exists accepted_types text[] not null default '{pdf,docx,xlsx}',
  add column if not exists allow_text boolean not null default true,
  add column if not exists allow_links boolean not null default true,
  add column if not exists ai_evaluation boolean not null default true,
  add column if not exists estimated_minutes int,
  add column if not exists position int not null default 0;
create index if not exists assignments_module_idx on public.assignments (module_id);

-- Answer keys and evaluator notes are never visible to learners.
create table if not exists public.assignment_answer_keys (
  assignment_id uuid primary key references public.assignments (id) on delete cascade,
  answer_key text,
  evaluator_notes text,
  updated_at timestamptz not null default now()
);
alter table public.assignment_answer_keys enable row level security;
drop policy if exists answer_keys_rw on public.assignment_answer_keys;
create policy answer_keys_rw on public.assignment_answer_keys for all to authenticated
  using (private.can_edit_course((select a.course_id from public.assignments a where a.id = assignment_id)) or private.owns_course((select a.course_id from public.assignments a where a.id = assignment_id)))
  with check (private.can_edit_course((select a.course_id from public.assignments a where a.id = assignment_id)));
grant select, insert, update, delete on public.assignment_answer_keys to authenticated;
grant all on public.assignment_answer_keys to service_role;

-- ---------------------------------------------------------------------------
-- 4. Submissions: versions, evaluation state, history
-- ---------------------------------------------------------------------------
alter table public.assignment_submissions drop constraint if exists assignment_submissions_check;
alter table public.assignment_submissions
  add column if not exists links text[] not null default '{}',
  add column if not exists file_name text,
  add column if not exists version int not null default 1,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists eval_status text not null default 'pending'
    check (eval_status in ('pending', 'evaluating', 'evaluated', 'needs_review', 'failed', 'reviewed')),
  add column if not exists evaluate_after timestamptz,
  add column if not exists score numeric(7, 2),
  add column if not exists max_score int,
  add column if not exists score_source text check (score_source in ('ai', 'human')),
  add column if not exists ai_criteria jsonb,
  add column if not exists evaluated_at timestamptz;
alter table public.assignment_submissions add constraint assignment_submissions_has_content
  check (text_response is not null or file_path is not null or cardinality(links) > 0);
alter table public.assignment_submissions add constraint assignment_submissions_links_check
  check (cardinality(links) <= 5);
create index if not exists assignment_submissions_eval_idx on public.assignment_submissions (eval_status, evaluate_after);
create index if not exists assignment_submissions_user_idx on public.assignment_submissions (user_id, submitted_at desc);

create table if not exists public.submission_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  version int not null,
  text_response text,
  file_path text,
  file_name text,
  links text[] not null default '{}',
  submitted_at timestamptz not null default now(),
  unique (submission_id, version)
);

create table if not exists public.assignment_evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  version int not null,
  evaluator text not null check (evaluator in ('ai', 'human')),
  reviewer_id uuid references public.profiles (id) on delete set null,
  score numeric(7, 2),
  max_score int,
  criteria jsonb,
  feedback text,
  model text,
  confidence text check (confidence in ('high', 'medium', 'low')),
  flagged_for_review boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists assignment_evaluations_sub_idx on public.assignment_evaluations (submission_id, created_at desc);

-- Durable job queue. Survives restarts; one job per submission version.
create table if not exists public.evaluation_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.assignment_submissions (id) on delete cascade,
  version int not null,
  run_at timestamptz not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'cancelled')),
  attempts int not null default 0,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, version)
);
create index if not exists evaluation_jobs_due_idx on public.evaluation_jobs (status, run_at);

alter table public.submission_history enable row level security;
alter table public.assignment_evaluations enable row level security;
alter table public.evaluation_jobs enable row level security;
drop policy if exists submission_history_select on public.submission_history;
create policy submission_history_select on public.submission_history for select to authenticated
  using (exists (select 1 from public.assignment_submissions s where s.id = submission_id
                 and (s.user_id = (select auth.uid()) or private.is_admin() or private.owns_course(s.course_id))));
drop policy if exists assignment_evaluations_select on public.assignment_evaluations;
create policy assignment_evaluations_select on public.assignment_evaluations for select to authenticated
  using (exists (select 1 from public.assignment_submissions s where s.id = submission_id
                 and (s.user_id = (select auth.uid()) or private.is_admin() or private.owns_course(s.course_id))));
drop policy if exists evaluation_jobs_admin on public.evaluation_jobs;
create policy evaluation_jobs_admin on public.evaluation_jobs for select to authenticated using (private.is_admin());
grant select on public.submission_history, public.assignment_evaluations, public.evaluation_jobs to authenticated;
grant all on public.submission_history, public.assignment_evaluations, public.evaluation_jobs to service_role;

-- Versioning trigger: any learner change to the content creates a new version,
-- resets evaluation fields (learners can never write scores) and schedules
-- evaluation ~60 minutes later. Runs after guard_submissions (alphabetical order).
create or replace function private.submission_versioning()
returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.assignments%rowtype; learner boolean;
begin
  learner := coalesce(new.user_id = (select auth.uid()), false) and not private.is_admin();
  if not learner then return new; end if;
  if tg_op = 'UPDATE' and new.text_response is not distinct from old.text_response
     and new.file_path is not distinct from old.file_path and new.links is not distinct from old.links then
    new.version := old.version; new.eval_status := old.eval_status; new.score := old.score; new.max_score := old.max_score;
    new.score_source := old.score_source; new.ai_criteria := old.ai_criteria; new.evaluated_at := old.evaluated_at;
    new.evaluate_after := old.evaluate_after; new.submitted_at := old.submitted_at;
    return new;
  end if;
  select * into a from public.assignments where id = new.assignment_id;
  new.version := case when tg_op = 'UPDATE' then old.version + 1 else 1 end;
  new.submitted_at := now();
  new.score := null; new.score_source := null; new.ai_criteria := null; new.evaluated_at := null; new.feedback := null;
  new.max_score := a.max_score;
  if a.ai_evaluation then
    new.eval_status := 'pending';
    new.evaluate_after := now() + interval '60 minutes';
  else
    new.eval_status := 'needs_review';
    new.evaluate_after := null;
  end if;
  return new;
end $$;

create or replace function private.submission_after_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.version is distinct from old.version then
    insert into public.submission_history (submission_id, version, text_response, file_path, file_name, links, submitted_at)
    values (new.id, new.version, new.text_response, new.file_path, new.file_name, new.links, new.submitted_at)
    on conflict (submission_id, version) do nothing;
    -- Supersede any older pending job, then schedule this version.
    update public.evaluation_jobs set status = 'cancelled', updated_at = now()
      where submission_id = new.id and version < new.version and status in ('queued', 'running');
    if new.eval_status = 'pending' and new.evaluate_after is not null then
      insert into public.evaluation_jobs (submission_id, version, run_at)
      values (new.id, new.version, new.evaluate_after)
      on conflict (submission_id, version) do nothing;
    end if;
  end if;
  return null;
end $$;

drop trigger if exists submission_versioning on public.assignment_submissions;
create trigger submission_versioning before insert or update on public.assignment_submissions
  for each row execute function private.submission_versioning();
drop trigger if exists submission_after_write on public.assignment_submissions;
create trigger submission_after_write after insert or update on public.assignment_submissions
  for each row execute function private.submission_after_write();

-- Learners may also store links/file name on insert.
drop policy if exists submissions_insert on public.assignment_submissions;
create policy submissions_insert on public.assignment_submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'submitted' and feedback is null and reviewed_by is null
    and private.is_enrolled(course_id)
    and exists (select 1 from public.assignments a where a.id = assignment_id and a.course_id = course_id)
  );

-- ---------------------------------------------------------------------------
-- 5. Worker functions (service role only)
-- ---------------------------------------------------------------------------
create or replace function public.claim_evaluation_jobs(p_limit int default 5)
returns setof public.evaluation_jobs language plpgsql security definer set search_path = '' as $$
begin
  return query
  update public.evaluation_jobs j
     set status = 'running', attempts = j.attempts + 1, locked_until = now() + interval '10 minutes', updated_at = now()
   where j.id in (
     select id from public.evaluation_jobs
      where (status = 'queued' and run_at <= now())
         or (status = 'running' and locked_until < now() and attempts < 3)
      order by run_at
      limit greatest(1, least(p_limit, 20))
      for update skip locked)
  returning j.*;
end $$;

create or replace function public.finish_evaluation_job(p_job_id uuid, p_status text, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  update public.evaluation_jobs
     set status = case when p_status = 'retry' and attempts < 3 then 'queued' when p_status = 'retry' then 'failed' else p_status end,
         run_at = case when p_status = 'retry' then now() + interval '10 minutes' else run_at end,
         last_error = p_error, locked_until = null, updated_at = now()
   where id = p_job_id;
$$;

-- Records an evaluation and updates the submission (AI from the worker; human via admin_review_submission).
create or replace function public.record_evaluation(
  p_submission_id uuid, p_version int, p_evaluator text, p_reviewer uuid, p_score numeric, p_criteria jsonb,
  p_feedback text, p_model text, p_confidence text, p_flag boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.assignment_submissions%rowtype; a public.assignments%rowtype; pct numeric; new_status public.submission_status; eval_state text;
begin
  select * into s from public.assignment_submissions where id = p_submission_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if p_evaluator = 'ai' and s.version <> p_version then
    return jsonb_build_object('skipped', true, 'reason', 'superseded');
  end if;
  select * into a from public.assignments where id = s.assignment_id;
  insert into public.assignment_evaluations (submission_id, version, evaluator, reviewer_id, score, max_score, criteria, feedback, model, confidence, flagged_for_review)
  values (s.id, s.version, p_evaluator, p_reviewer, p_score, a.max_score, p_criteria, p_feedback, p_model, p_confidence, coalesce(p_flag, false));
  pct := case when a.max_score > 0 and p_score is not null then p_score * 100.0 / a.max_score else 0 end;
  if p_evaluator = 'ai' and coalesce(p_flag, false) then
    eval_state := 'needs_review'; new_status := 'submitted';
  else
    eval_state := case when p_evaluator = 'human' then 'reviewed' else 'evaluated' end;
    new_status := case when pct >= a.pass_pct then 'approved' else 'needs_revision' end;
  end if;
  update public.assignment_submissions
     set score = p_score, max_score = a.max_score, score_source = p_evaluator, ai_criteria = coalesce(p_criteria, ai_criteria),
         feedback = p_feedback, eval_status = eval_state, evaluated_at = now(), status = new_status,
         reviewed_by = case when p_evaluator = 'human' then p_reviewer else reviewed_by end,
         reviewed_at = case when p_evaluator = 'human' then now() else reviewed_at end
   where id = s.id;
  perform private.notify(s.user_id, 'assignment_evaluated',
    case when eval_state = 'needs_review' then 'Your assignment is with a reviewer' else 'Your assignment has been evaluated' end,
    case when eval_state = 'needs_review' then 'An automated check is done and a human reviewer will confirm your marks for "' || a.title || '".'
         else 'Results for "' || a.title || '" are ready: ' || coalesce(round(p_score)::text, '–') || '/' || a.max_score || '.' end,
    '/dashboard/results');
  return jsonb_build_object('ok', true, 'eval_status', eval_state, 'status', new_status);
end $$;

create or replace function public.mark_evaluation_failed(p_submission_id uuid, p_version int, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.assignment_submissions%rowtype;
begin
  select * into s from public.assignment_submissions where id = p_submission_id;
  if not found or s.version <> p_version then return; end if;
  update public.assignment_submissions set eval_status = 'needs_review' where id = s.id;
  perform private.audit(null, 'evaluation.failed', 'assignment_submission', s.id::text, jsonb_build_object('reason', left(p_reason, 500)));
end $$;

revoke all on function public.claim_evaluation_jobs(int) from public, anon, authenticated;
revoke all on function public.finish_evaluation_job(uuid, text, text) from public, anon, authenticated;
revoke all on function public.record_evaluation(uuid, int, text, uuid, numeric, jsonb, text, text, text, boolean) from public, anon, authenticated;
revoke all on function public.mark_evaluation_failed(uuid, int, text) from public, anon, authenticated;
grant execute on function public.claim_evaluation_jobs(int), public.finish_evaluation_job(uuid, text, text),
  public.record_evaluation(uuid, int, text, uuid, numeric, jsonb, text, text, text, boolean),
  public.mark_evaluation_failed(uuid, int, text) to service_role;

-- Human review / override (admin, or the course's own instructor).
create or replace function public.admin_review_submission(p_submission_id uuid, p_score numeric, p_feedback text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.assignment_submissions%rowtype; a public.assignments%rowtype; uid uuid := private.require_user(); r jsonb;
begin
  select * into s from public.assignment_submissions where id = p_submission_id;
  if not found then raise exception 'Submission not found'; end if;
  if not (private.is_admin() or private.owns_course(s.course_id)) then raise exception 'Not allowed' using errcode = '42501'; end if;
  select * into a from public.assignments where id = s.assignment_id;
  if p_score is null or p_score < 0 or p_score > a.max_score then raise exception 'Score must be between 0 and %', a.max_score; end if;
  r := public.record_evaluation(s.id, s.version, 'human', uid, p_score, null, p_feedback, null, null, false);
  update public.evaluation_jobs set status = 'cancelled', updated_at = now() where submission_id = s.id and status in ('queued', 'running');
  perform private.audit(uid, 'submission.reviewed', 'assignment_submission', s.id::text, jsonb_build_object('score', p_score));
  return r;
end $$;
grant execute on function public.admin_review_submission(uuid, numeric, text) to authenticated;

-- Re-queue an evaluation now (admin).
create or replace function public.admin_requeue_evaluation(p_submission_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.assignment_submissions%rowtype;
begin
  perform private.require_admin();
  select * into s from public.assignment_submissions where id = p_submission_id;
  if not found then raise exception 'Submission not found'; end if;
  insert into public.evaluation_jobs (submission_id, version, run_at) values (s.id, s.version, now())
  on conflict (submission_id, version) do update set status = 'queued', run_at = now(), attempts = 0, last_error = null, updated_at = now();
  update public.assignment_submissions set eval_status = 'pending' where id = s.id;
end $$;
grant execute on function public.admin_requeue_evaluation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Scheduler secret (read by the evaluation route through the service role)
-- ---------------------------------------------------------------------------
create table if not exists private.app_settings (key text primary key, value text not null, updated_at timestamptz not null default now());
insert into private.app_settings (key, value) values ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;
create or replace function public.get_cron_secret()
returns text language sql stable security definer set search_path = '' as $$
  select value from private.app_settings where key = 'cron_secret';
$$;
revoke all on function public.get_cron_secret() from public, anon, authenticated;
grant execute on function public.get_cron_secret() to service_role;

