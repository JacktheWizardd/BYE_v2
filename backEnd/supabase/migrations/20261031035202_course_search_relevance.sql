begin;
create or replace function public.bye_search_courses(p_school text,p_term text,p_query text,p_offset int,p_limit int)
returns table(id text,code text,title text) language sql stable security invoker set search_path='' as $$
with input as (select lower(trim(coalesce(p_query,''))) q,public.bye_code_alias(trim(coalesce(p_query,''))) alias)
select c.id,c.code,c.title from public.bye_courses c cross join input i
where c.school_id=p_school and c.term_id=p_term
and (i.q='' or not exists(select 1 from unnest(regexp_split_to_array(i.q,'\s+')) word where strpos(lower(c.code||' '||c.title),word)=0)
 or (i.alias<>'' and strpos(public.bye_code_alias(c.code),i.alias)>0))
order by case
 when lower(c.code)=i.q then 0
 when i.alias<>'' and public.bye_code_alias(c.code)=i.alias then 1
 when i.q<>'' and split_part(lower(c.code),' ',1)=i.q then 2
 when i.alias<>'' and starts_with(public.bye_code_alias(c.code),i.alias) then 3
 when i.q<>'' and starts_with(lower(c.title),i.q) then 4
 else 5 end,c.id
limit least(greatest(p_limit,0),101) offset greatest(p_offset,0);
$$;
commit;
