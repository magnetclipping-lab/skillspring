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
