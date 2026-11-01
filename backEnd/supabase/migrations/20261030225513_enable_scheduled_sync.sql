select vault.create_secret('https://yjcrupbibflagchcdeun.supabase.co','bye_project_url') where not exists(select 1 from vault.secrets where name='bye_project_url');
-- Run AFTER deploying bye-sync. Store bye_project_url and bye_cron_secret in
-- Supabase Vault first; never commit their values. Invoke once a minute; DB leases
-- and due times enforce the actual five-minute active-semester refresh cadence.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('bye-sync-every-minute','* * * * *',$job$
select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='bye_project_url')||'/functions/v1/bye-sync',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='bye_cron_secret')),
 body:='{}'::jsonb,timeout_milliseconds:=90000);
$job$);
