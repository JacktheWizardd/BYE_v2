import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';
import {createProductionApi,digest,generateInviteCode} from '../src/production.js';
const directory=new URL('../supabase/migrations/',import.meta.url);
test('reusable owner code, single-use readers, role isolation, expiry and shared lockout',async()=>{
 const db=new PGlite();try{
 await db.exec('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);');
 const latest=(await readdir(directory)).find(n=>n.endsWith('_owner_access_code.sql'));
 for(const name of ['20261030225302_production_backend.sql','20261031033859_schedule_discovery.sql',latest])await db.exec(await readFile(new URL(name,directory),'utf8'));
 const ids=Array.from({length:10},(_,i)=>`00000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`);
 for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
 await db.query("insert into bye_memberships values($1,'owner',now()+interval '30 days',null,null)",[ids[0]]);
 const control=async(action,p={})=>(await db.query('select bye_control($1,$2::jsonb) d',[action,JSON.stringify(p)])).rows[0].d;
 const ownerHash='a'.repeat(64),readerHash='b'.repeat(64);
 assert.equal((await control('set_owner_code',{user_id:ids[1],hash:ownerHash})).error,'forbidden');
 assert.equal((await control('set_owner_code',{user_id:ids[0],hash:ownerHash})).configured,true);
 await db.query('insert into bye_invites(code_hash) values($1)',[readerHash]);
 assert.equal((await control('set_owner_code',{user_id:ids[0],hash:readerHash})).error,'code_conflict');
 assert.equal((await control('redeem',{user_id:ids[1],actor:'reader-ip',hash:readerHash,role:'owner'})).ok,true);
 assert.equal((await control('membership',{user_id:ids[1]})).role,'reader');
 assert.equal((await control('redeem',{user_id:ids[2],actor:'other-ip',hash:readerHash})).error,'invalid_invite');
 for(const id of [ids[1],ids[3]]){assert.equal((await control('redeem',{user_id:id,actor:id,hash:ownerHash})).role,'owner');const member=await control('membership',{user_id:id});assert.equal(member.role,'owner');assert.equal(member.invite_id,null)}
 const invite=(await db.query('select id from bye_invites')).rows[0];await control('revoke_invite',invite);assert.equal((await control('membership',{user_id:ids[1]})).role,'owner');
 await db.query("update bye_memberships set expires_at=now()-interval '1 day' where user_id=$1",[ids[3]]);assert.equal(await control('membership',{user_id:ids[3]}),null);
 await control('redeem',{user_id:ids[3],actor:'renew',hash:ownerHash});assert.equal((await control('membership',{user_id:ids[3]})).role,'owner');
 for(let n=0;n<3;n++)assert.equal((await control('redeem',{user_id:ids[4],actor:'blocked-ip',hash:'incorrect'})).error,'invalid_invite');
 assert.equal((await control('redeem',{user_id:ids[4],actor:'new-ip',hash:ownerHash})).error,'rate_limited');
 assert.equal((await control('redeem',{user_id:ids[5],actor:'blocked-ip',hash:ownerHash})).error,'rate_limited');
 await db.exec("update bye_attempts set attempted_at=now()-interval '61 seconds'");assert.equal((await control('redeem',{user_id:ids[4],actor:'blocked-ip',hash:ownerHash})).role,'owner');
 const outcomes=await Promise.all([ids[6],ids[7]].map(user_id=>control('redeem',{user_id,actor:'simultaneous',hash:ownerHash})));assert.ok(outcomes.every(x=>x.role==='owner'));
 const code='c'.repeat(64);await db.query('insert into bye_invites(code_hash)values($1)',[code]);const readers=await Promise.all([ids[8],ids[9]].map(user_id=>control('redeem',{user_id,actor:'same-reader-ip',hash:code})));assert.equal(readers.filter(x=>x.ok).length,1);assert.equal(readers.filter(x=>x.error==='invalid_invite').length,1);
 assert.equal((await control('membership',{user_id:ids[0]})).role,'owner');
 // Scheduling still traverses the public wrapper and publishes through the existing core.
 await db.exec("update bye_schools set status='active' where id='pasadena-city-college';insert into bye_terms values('pasadena-city-college','202730','Spring',now())");
 await control('touch',{school_id:'pasadena-city-college',term_id:'202730'});await control('schedule');const job=await control('claim');assert.ok(job?.id);
 await db.query("update bye_jobs set kind='preview' where id=$1",[job.id]);await control('stage',{id:job.id,token:job.lease_token,catalog:{}});await control('finish',{id:job.id,token:job.lease_token,metrics:{}});assert.equal((await db.query('select status from bye_jobs where id=$1',[job.id])).rows[0].status,'succeeded');
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);for(const sql of ['select * from bye_owner_credentials',"update bye_owner_credentials set code_hash=repeat('d',64)","select bye_control('set_owner_code','{}')","select bye_control_core('redeem','{}')"])await assert.rejects(db.query(sql));await db.exec('reset role')}
 }finally{await db.close()}
});
test('reader invite generation cannot emit a numeric owner code',()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const value=generateInviteCode(new Uint8Array(8).fill(alphabet.indexOf('2')));assert.match(value,/^[A-Z2-9]{8}$/);assert.match(value,/[A-Z]/)});
test('owner credential setup requires owner membership and sends only a hash to storage',async()=>{let role='reader',saved;const repository={control:async(action,p)=>{if(action==='membership')return {role};saved=p;return {configured:true}}};const config={url:'https://project.supabase.co',secret:'secret',publishableKey:'public',pepper:'x'.repeat(32),repository,fetcher:async()=>Response.json({id:'verified-user'})};const handler=createProductionApi(config);const request=code=>handler(new Request('https://test/v1/admin/owner-code',{method:'POST',headers:{authorization:'Bearer session','content-type':'application/json'},body:JSON.stringify({code})}));
 assert.equal((await request('2468-1357')).status,403);assert.equal(saved,undefined);role='owner';assert.equal((await request('not-a-code')).status,400);const result=await request('2468-1357');assert.equal(result.status,200);assert.equal(saved.hash,await digest('24681357',config.pepper));assert.equal(saved.code,undefined);assert.equal(saved.user_id,'verified-user');assert.deepEqual(await result.json(),{data:{configured:true}});
});
