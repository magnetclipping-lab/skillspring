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
