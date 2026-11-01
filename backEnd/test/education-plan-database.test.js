import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';import {readFile} from 'node:fs/promises';
test('education plans: ownership, compare-and-swap, membership and Data API denial',async()=>{const db=new PGlite();try{
 await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table bye_memberships(user_id uuid primary key,expires_at timestamptz,revoked_at timestamptz);");
 await db.exec(await readFile(new URL('../supabase/migrations/20261101071619_education_plan_storage.sql',import.meta.url),'utf8'));
 const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
 await db.query('insert into auth.users values($1),($2)',[a,b]);await db.query("insert into bye_memberships values($1,now()+interval '1 day',null),($2,now()+interval '1 day',null)",[a,b]);
 const call=async(user,action='read',rev=null,plan=null)=>(await db.query('select bye_education_plan($1,$2,$3,$4::jsonb) d',[user,action,rev,plan===null?null:JSON.stringify(plan)])).rows[0].d;
 assert.equal((await call(a)).data,null);const saved=await call(a,'save',0,{version:1});assert.equal(saved.data.revision,1);assert.equal((await call(b)).data,null);
 const results=await Promise.all([call(a,'save',1,{value:'one'}),call(a,'save',1,{value:'two'})]);assert.equal(results.filter(r=>r.error==='revision_conflict').length,1);assert.equal((await call(a)).data.revision,2);
 const previous=(await call(a)).data;assert.equal((await call(a,'save',0,{})).error,'revision_conflict');assert.deepEqual((await call(a)).data,previous);
 await db.query('update bye_memberships set revoked_at=now() where user_id=$1',[a]);assert.equal((await call(a)).error,'access_required');assert.equal((await call(a,'save',2,{})).error,'access_required');
 await db.query("update bye_memberships set expires_at=now()-interval '1 second' where user_id=$1",[b]);assert.equal((await call(b)).error,'access_required');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(db.query('select * from bye_education_plans'));await assert.rejects(call(a));await db.exec('reset role');}
}finally{await db.close()}});
