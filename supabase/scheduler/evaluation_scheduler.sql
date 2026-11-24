-- Schedules the assignment evaluation worker every 5 minutes with pg_cron + pg_net.
-- Requires the pg_cron and pg_net extensions (Supabase: Database → Extensions) and the
-- deployed site URL. The worker authenticates with private.app_settings.cron_secret.
-- Set the URL once:  update private.app_settings set value = 'https://your-domain' where key = 'site_url';
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

insert into private.app_settings (key, value) values ('site_url', 'https://skillspring-ecru.vercel.app')
on conflict (key) do nothing;

create or replace function private.trigger_evaluation_worker()
returns void language plpgsql security definer set search_path = '' as $$
declare url text; secret text;
begin
  -- Only call out when something is actually due.
  if not exists (select 1 from public.evaluation_jobs
                 where (status = 'queued' and run_at <= now()) or (status = 'running' and locked_until < now() and attempts < 3)) then
    return;
  end if;
  select value into url from private.app_settings where key = 'site_url';
  select value into secret from private.app_settings where key = 'cron_secret';
  if url is null or secret is null then return; end if;
  perform net.http_post(
    url := rtrim(url, '/') || '/api/cron/evaluate',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
end $$;
revoke all on function private.trigger_evaluation_worker() from public;

select cron.unschedule(jobid) from cron.job where jobname = 'proofwork-evaluate';
select cron.schedule('proofwork-evaluate', '*/5 * * * *', $$select private.trigger_evaluation_worker()$$);
