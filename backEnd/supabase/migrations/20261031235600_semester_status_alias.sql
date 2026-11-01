create or replace function public.bye_semesters(action text,p jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare s text:=p->>'school_id'; t text:=p->>'term_id'; j public.bye_jobs; w public.bye_worker; result jsonb;
begin
if action='schedule' then
 for s in select id from public.bye_schools where status='active' and connector='pcc' loop
 if not exists(select 1 from public.bye_term_directory where school_id=s and checked_at>now()-interval '1 day') then
 perform public.bye_control('enqueue',jsonb_build_object('school_id',s,'term_id','directory','kind','directory'));end if;end loop;return '{}';
elsif action='directory_finish' then
 select * into w from public.bye_worker where id for update;
 if w.job_id is distinct from (p->>'id')::uuid or w.token is distinct from (p->>'token')::uuid or w.lease_until<=now() then raise exception 'Lease expired';end if;
 select * into j from public.bye_jobs where id=w.job_id;
 if j.kind<>'directory' or jsonb_typeof(p->'terms')<>'array' or jsonb_array_length(p->'terms')=0 then raise exception 'Invalid directory';end if;
 insert into public.bye_term_directory values(j.school_id,p->'terms',now()) on conflict(school_id) do update set terms=excluded.terms,checked_at=excluded.checked_at;
 update public.bye_jobs set status='succeeded',finished_at=now() where id=j.id;
 update public.bye_worker set job_id=null,token=null,lease_until=null where id;return '{}';
end if;
if not exists(select 1 from public.bye_schools where id=s and status='active') then raise exception 'School unavailable';end if;
if action='list' then
 select coalesce(jsonb_agg(x order by x->>'id' desc),'[]') into result from (
 select jsonb_build_object('id',id,'name',name,'imported',true) x from public.bye_terms where school_id=s
 union all select d||jsonb_build_object('imported',false) from public.bye_term_directory,jsonb_array_elements(terms)d where school_id=s and not exists(select 1 from public.bye_terms where school_id=s and id=d->>'id'))a;
 return result;
elsif action='load' then
 perform 1 from public.bye_schools where id=s for update;
 if not exists(select 1 from public.bye_terms where school_id=s and id=t) then
 if not exists(select 1 from public.bye_term_directory,jsonb_array_elements(terms)d where school_id=s and d->>'id'=t) then return '{"error":"term_not_published"}';end if;
 perform public.bye_control('enqueue',jsonb_build_object('school_id',s,'term_id',t,'kind','catalog'));
 end if;
end if;
select * into j from public.bye_jobs where school_id=s and term_id=t order by created_at desc limit 1;
select jsonb_build_object('imported',exists(select 1 from public.bye_terms where school_id=s and id=t),'status',coalesce(j.status,'not_loaded'),'last_failure',j.error_code,'last_successful_check',f.last_success,'next_eligible_at',greatest(f.next_due,worker.next_fetch_at),'job_id',j.id) into result
from public.bye_worker worker left join public.bye_refresh f on f.school_id=s and f.term_id=t where worker.id;
return result;
end $$;
