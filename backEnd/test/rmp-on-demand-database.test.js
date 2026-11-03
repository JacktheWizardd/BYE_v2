import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
const migration=name=>readFile(new URL(`../supabase/migrations/${name}.sql`,import.meta.url),'utf8');
test('on-demand RMP keeps six-month freshness, caps daily source requests, counts usage and removes the crawler',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema cron;
 create table cron.job(jobid bigint primary key,jobname text);insert into cron.job values(4,'bye-rmp-background');
 create function cron.schedule(text,text,text) returns bigint language sql as 'select 1::bigint';
 create function cron.unschedule(bigint) returns boolean language sql as 'delete from cron.job where jobid=$1 returning true';`);
 await db.exec(await migration('20261031043108_rmp_cache'));
 // Later columns/tables the current bye_rmp depends on, and the crawler objects being removed.
 await db.exec(`alter table bye_rmp_settings add column manual_refresh_seconds integer not null default 1800;
 create table bye_rmp_manual(key text primary key,next_at timestamptz not null);
 create table bye_rmp_usage(day date primary key,jobs int not null default 0,failures int not null default 0,requests int not null default 0);
 create table bye_rmp_background(school_id text,instructor_id uuid);
 create function bye_rmp_scope() returns int language sql as 'select 1';
 create function bye_rmp_background(action text,p jsonb default '{}') returns jsonb language sql as 'select ''{}''::jsonb';
 update bye_rmp_settings set enabled=true;`);
 await db.exec(await migration('20261103233000_rmp_on_demand'));
 const call=async(action,p={})=>(await db.query('select bye_rmp($1,$2::jsonb) d',[action,JSON.stringify(p)])).rows[0].d;
 const one=async sql=>(await db.query(sql)).rows[0];
 assert.equal((await one('select count(*)::int n from cron.job')).n,0);
 assert.equal((await one("select to_regclass('public.bye_rmp_background') t")).t,null);
 assert.equal((await one("select count(*)::int n from pg_proc where proname in ('bye_rmp_background','bye_rmp_scope')")).n,0);
 // Fresh for six months; older entries are leased for a refetch with the previous data kept.
 const c=await call('cache',{key:'k'});await call('publish',{key:'k',token:c.token,data:{rating:4}});
 await db.exec("update bye_rmp_cache set checked_at=now()-interval '5 months'");assert.deepEqual((await call('cache',{key:'k'})).data,{rating:4});assert.equal((await call('cache',{key:'k'})).token,undefined);
 await db.exec("update bye_rmp_cache set checked_at=now()-interval '7 months'");const old=await call('cache',{key:'k'});assert.ok(old.token);assert.deepEqual(old.data,{rating:4});await call('abandon',{key:'k',token:old.token});
 // Reviews entries survive up to a year before eviction.
 await db.exec(`insert into bye_rmp_cache(key,data,checked_at) values('["x","1","reviews"]','{}',now()-interval '11 months'),('["x","2","reviews"]','{}',now()-interval '13 months')`);
 const n=await call('cache',{key:'new'});await call('publish',{key:'new',token:n.token,data:{}});
 assert.deepEqual((await db.query(`select key from bye_rmp_cache where key like '%"reviews"%' order by key`)).rows.map(r=>r.key),['["x","1","reviews"]']);
 // Each granted source attempt is counted; the daily cap refuses until the next Pacific day.
 const ready="delete from bye_rmp_slots;update bye_rmp_settings set next_start=now()-interval '1 second',cooldown=now()-interval '1 second',attempts=0";
 await db.exec(ready+',daily_request_cap=2');
 assert.ok((await call('acquire')).token);await db.exec(ready);assert.ok((await call('acquire')).token);await db.exec(ready);
 const capped=await call('acquire');assert.equal(capped.token,undefined);assert.ok(capped.retry_after>0&&capped.retry_after<=25*3600);
 assert.equal((await one('select requests from bye_rmp_usage')).requests,2);
 await db.exec('update bye_rmp_settings set daily_request_cap=200');assert.ok((await call('acquire')).token);assert.equal((await one('select requests from bye_rmp_usage')).requests,3);
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(call('acquire'));await assert.rejects(db.query('select * from bye_rmp_cache'));await db.exec('reset role');}
 }finally{await db.close()}
});
