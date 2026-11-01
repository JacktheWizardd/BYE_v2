begin;
select vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'bye_invite_pepper') where not exists(select 1 from vault.secrets where name='bye_invite_pepper');
select vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'bye_cron_secret') where not exists(select 1 from vault.secrets where name='bye_cron_secret');
-- Uses service_role's existing Vault privilege; does not expand database grants.
create function public.bye_runtime_secrets() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('pepper',(select decrypted_secret from vault.decrypted_secrets where name='bye_invite_pepper'),'cron_secret',(select decrypted_secret from vault.decrypted_secrets where name='bye_cron_secret'));
$$;
revoke all on function public.bye_runtime_secrets() from public,anon,authenticated;
grant execute on function public.bye_runtime_secrets() to service_role;
commit;
