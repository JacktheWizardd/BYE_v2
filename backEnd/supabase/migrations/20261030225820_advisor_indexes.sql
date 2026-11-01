create index bye_invites_used_by on public.bye_invites(used_by);
create index bye_section_instructors_identity on public.bye_section_instructors(school_id,instructor_id);
alter table public.bye_attempts add column id uuid primary key default gen_random_uuid();
