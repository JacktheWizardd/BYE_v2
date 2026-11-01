begin;
-- Keep the hash/audit record so a removed code cannot become valid again.
alter table public.bye_invites add column deleted_at timestamptz;
create function public.bye_delete_invite(p_owner uuid,p_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.bye_memberships where user_id=p_owner and role='owner' and revoked_at is null and expires_at>now()) then return '{"error":"forbidden"}';end if;
 -- Same row lock as ordinary redemption: deletion and redemption are atomic.
 perform 1 from public.bye_invites where id=p_id for update;
 if not found then return '{"deleted":false}';end if;
 update public.bye_invites set deleted_at=coalesce(deleted_at,now()),revoked_at=coalesce(revoked_at,now()) where id=p_id;
 update public.bye_memberships set revoked_at=coalesce(revoked_at,now()) where invite_id=p_id and role='reader';
 return '{"deleted":true}';
end;$$;
revoke all on function public.bye_delete_invite(uuid,uuid) from public,anon,authenticated;
grant execute on function public.bye_delete_invite(uuid,uuid) to service_role;
commit;
