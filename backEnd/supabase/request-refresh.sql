begin;
create function public.bye_request_refresh(p_school text,p_term text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.bye_jobs; deadline timestamptz;
begin
perform 1 from public.bye_schools where id=p_school and status='active' for update;
if not found then return '{"error":"school_unavailable"}';end if;
if not exists(select 1 from public.bye_terms where school_id=p_school and id=p_term) then return '{"error":"term_not_imported"}';end if;
perform public.bye_control('touch',jsonb_build_object('school_id',p_school,'term_id',p_term));
select * into j from public.bye_jobs where school_id=p_school and term_id=p_term and status in('queued','running');
if not found then
select next_due into deadline from public.bye_refresh where school_id=p_school and term_id=p_term;
insert into public.bye_jobs(school_id,term_id,kind,due_at) values(p_school,p_term,'availability',greatest(now(),deadline));
end if;
return public.bye_semesters('status',jsonb_build_object('school_id',p_school,'term_id',p_term));
end $$;
revoke all on function public.bye_request_refresh(text,text) from public,anon,authenticated;
grant execute on function public.bye_request_refresh(text,text) to service_role;
commit;
