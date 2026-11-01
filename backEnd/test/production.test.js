import test from 'node:test';import assert from 'node:assert/strict';
import {createProductionApi} from '../src/production.js';import {runSync} from '../src/sync.js';
const config={url:'https://project.supabase.co',secret:'secret',publishableKey:'public',pepper:'a'.repeat(32),fetcher:async()=>Response.json({id:'user'})};
test('production checks membership on every request, including revoked sessions and owner routes',async()=>{
 let member=null;
 const handler=createProductionApi({...config,repository:{control:async()=>member}});
 const request=path=>handler(new Request('https://test'+path,{headers:{authorization:'Bearer session'}}));
 assert.equal((await request('/v1/me')).status,403);assert.equal((await request('/v1/schools/pasadena-city-college/instructors/00000000-0000-0000-0000-000000000001/rmp/profile')).status,403);
 member={role:'reader'};assert.equal((await request('/v1/me')).status,200);assert.equal((await request('/v1/admin/invites')).status,403);
 member=null;assert.equal((await request('/v1/me')).status,403);assert.equal((await request('/v1/schools/pasadena-city-college/instructors/00000000-0000-0000-0000-000000000001/rmp/profile')).status,403);
});
test('worker stages before publication and records failures without publishing',async()=>{
 const calls=[];const job={id:'job',school_id:'pcc',term_id:'term',lease_token:'token'};
 const repo={control:async(action,p)=>{calls.push([action,p]);return action==='claim'?job:null},school:async()=>({status:'active',connector:'pcc'})};
 const connectors=new Map([['pcc',{terms:async()=>[{id:'term'}],importTerm:async()=>({term:{id:'term'},courses:[],sections:[]})}]]);
 assert.equal((await runSync(repo,{connectors})).status,'succeeded');assert.deepEqual(calls.map(c=>c[0]),['schedule','claim','stage','finish']);
 calls.length=0;connectors.get('pcc').importTerm=async()=>{throw Object.assign(new Error(),{retrySeconds:700,code:'source_unavailable'})};
 assert.equal((await runSync(repo,{connectors})).status,'failed');assert.deepEqual(calls.map(c=>c[0]),['schedule','claim','fail']);assert.equal(calls[2][1].retry_seconds,700);
});

test('RMP Retry-After is exposed to the exact frontend origin',async()=>{const handler=createProductionApi({...config,allowedOrigin:'http://localhost:5173',repository:{control:async()=>({role:'reader'})}});const response=await handler(new Request('https://test/v1/me',{headers:{authorization:'Bearer session',origin:'http://localhost:5173'}}));assert.equal(response.headers.get('access-control-expose-headers'),'Retry-After, Server-Timing')});

test('timings require the configured reader and retain membership checks',async()=>{
 let calls=0;const repository={control:async()=>{calls++;return {role:'reader'}}};
 for(const benchmarkUserId of [null,'other','user']){const handler=createProductionApi({...config,repository,benchmarkUserId});const r=await handler(new Request('https://test/v1/me',{headers:{authorization:'Bearer session'}}));assert.equal(r.status,200);assert.equal(r.headers.has('server-timing'),benchmarkUserId==='user');if(benchmarkUserId==='user')assert.match(r.headers.get('server-timing'),/auth;dur=.*membership;dur=.*total;dur=/)}assert.equal(calls,3);
});

test('disabled benchmark requests cannot fall through to source-capable routes',async()=>{const handler=createProductionApi({...config,repository:{control:async()=>({role:'reader'})}});const r=await handler(new Request('https://test/v1/schools/pasadena-city-college/instructors/00000000-0000-0000-0000-000000000001/rmp/profile?bye_benchmark=cache-only',{headers:{authorization:'Bearer session'}}));assert.equal(r.status,403);assert.equal((await r.json()).error.code,'benchmark_disabled')});

test('deployed frontend CORS allows only exact configured origins and keeps access checks',async()=>{
 const site='https://bye-web-v2.jack-truong2k1.workers.dev';let member={role:'reader'};
 const handler=createProductionApi({...config,allowedOrigin:['http://localhost:5173',site],repository:{control:async()=>member}});
 for(const origin of ['http://localhost:5173',site,site+'.attacker.test','https://preview-bye-web-v2.jack-truong2k1.workers.dev','null']){
  const headers={authorization:'Bearer session',origin};const r=await handler(new Request('https://test/v1/me',{headers}));assert.equal(r.status,200);assert.equal(r.headers.get('access-control-allow-origin'),['http://localhost:5173',site].includes(origin)?origin:null);assert.equal(r.headers.get('vary'),'Origin');
  const preflight=await handler(new Request('https://test/v1/me',{method:'OPTIONS',headers:{origin}}));assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),['http://localhost:5173',site].includes(origin)?origin:null);
 }
 member=null;const denied=await handler(new Request('https://test/v1/me',{headers:{authorization:'Bearer session',origin:site}}));assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),site);
});
