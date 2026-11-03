-- Review/apply separately AFTER deploying bye-rmp and reconciling live source drift.
-- Reuses the existing Vault values; no secret values belong in this file.
select cron.schedule('bye-rmp-background','*/5 * * * *',$job$
select net.http_post(
 url:=(select decrypted_secret from vault.decrypted_secrets where name='bye_project_url')||'/functions/v1/bye-rmp',
 headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='bye_cron_secret')),
 body:='{}'::jsonb,timeout_milliseconds:=120000);
$job$);
