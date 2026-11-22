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
