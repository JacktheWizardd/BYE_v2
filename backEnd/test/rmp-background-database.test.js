import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
test('catalog scheduling deduplicates claims, retries failures, rejects old leases and denies browser roles',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table bye_schools(id text primary key,status text);create table bye_instructors(school_id text,id uuid,name text,primary key(school_id,id));
 create table bye_rmp_settings(id boolean primary key,enabled boolean);insert into bye_rmp_settings values(true,true);
 insert into bye_schools values('pasadena-city-college','active');
 insert into bye_instructors values('pasadena-city-college','00000000-0000-0000-0000-000000000001','Example Instructor');`);
 await db.exec(await readFile(new URL('../supabase/migrations/20261103194701_rmp_background_privacy.sql',import.meta.url),'utf8'));
 const call=async(action,p={})=>(await db.query('select bye_rmp_background($1,$2::jsonb) d',[action,JSON.stringify(p)])).rows[0].d;
 const [a,b]=await Promise.all([call('claim'),call('claim')]);assert.ok(a.token);assert.deepEqual(b,{});
 assert.deepEqual(Object.keys(a).sort(),['instructor_id','school_id','token']);
 await call('finish',{...a,token:crypto.randomUUID()});assert.deepEqual(await call('claim'),{});
 assert.equal((await call('finish',a)).ok,true);assert.deepEqual(await call('claim'),{});
 assert.ok((await db.query("select next_at>now()+interval '6 days' ok from bye_rmp_background")).rows[0].ok);
 await db.exec("update bye_rmp_background set next_at=now()-interval '1 second'");const c=await call('claim');
 await call('fail',c);assert.ok((await db.query("select next_at>now()+interval '59 minutes' ok from bye_rmp_background")).rows[0].ok);
 await db.exec("update bye_rmp_background set next_at=now()-interval '1 second'");const d=await call('claim');
 await db.exec("update bye_rmp_background set lease_until=now()-interval '1 second',next_at=now()-interval '1 second'");const e=await call('claim');assert.notEqual(d.token,e.token);assert.equal((await call('finish',d)).ok,false);await call('finish',e);
 await db.exec("update bye_rmp_background set next_at=now()-interval '1 second';update bye_rmp_settings set enabled=false");assert.deepEqual(await call('claim'),{});
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(call('claim'));await assert.rejects(db.query('select * from bye_rmp_background'));await db.exec('reset role');}
 }finally{await db.close()}
});
