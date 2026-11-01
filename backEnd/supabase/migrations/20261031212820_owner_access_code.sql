begin;
create table public.bye_owner_credentials (
 id boolean primary key default true check(id),
 code_hash text not null check(code_hash ~ '^[a-f0-9]{64}$'),
 updated_at timestamptz not null default now()
);
alter table public.bye_owner_credentials enable row level security;
revoke all on public.bye_owner_credentials from public,anon,authenticated;
grant select,insert,update on public.bye_owner_credentials to service_role;

-- Preserve the established invite/job/synchronization implementation unchanged.
alter function public.bye_control(text,jsonb) rename to bye_control_core;
revoke all on function public.bye_control_core(text,jsonb) from public,anon,authenticated;
grant execute on function public.bye_control_core(text,jsonb) to service_role;
create function public.bye_control(action text,p jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if action='set_owner_code' then
  if not exists(select 1 from public.bye_memberships where user_id=(p->>'user_id')::uuid and role='owner' and revoked_at is null and expires_at>now()) then return '{"error":"forbidden"}';end if;
  if p->>'hash' is null or p->>'hash' !~ '^[a-f0-9]{64}$' then raise exception 'Invalid credential hash';end if;
  if exists(select 1 from public.bye_invites where code_hash=p->>'hash') then return '{"error":"code_conflict"}';end if;
  insert into public.bye_owner_credentials(id,code_hash) values(true,p->>'hash') on conflict(id) do update set code_hash=excluded.code_hash,updated_at=now();
  return '{"configured":true}';
 elsif action='redeem' then
  -- Same distributed attempt budget as ordinary invites. User + IP locks also
  -- serialize competing owner/reader redemptions for one anonymous identity.
  perform pg_advisory_xact_lock(hashtextextended(p->>'actor',0));
  perform pg_advisory_xact_lock(hashtextextended(p->>'user_id',1));
  if exists(select 1 from public.bye_attempts where actor in(p->>'actor',p->>'user_id') and attempted_at>now()-interval '1 minute' group by actor having count(*)>=3) then return '{"error":"rate_limited"}';end if;
  if exists(select 1 from public.bye_owner_credentials where id and code_hash=p->>'hash') then
   insert into public.bye_memberships(user_id,role,expires_at,revoked_at,invite_id) values((p->>'user_id')::uuid,'owner',now()+interval '30 days',null,null)
   on conflict(user_id) do update set role='owner',expires_at=excluded.expires_at,revoked_at=null,invite_id=null;
   return '{"ok":true,"role":"owner"}';
  end if;
 end if;
 return public.bye_control_core(action,p);
end;$$;
revoke all on function public.bye_control(text,jsonb) from public,anon,authenticated;
grant execute on function public.bye_control(text,jsonb) to service_role;
commit;
