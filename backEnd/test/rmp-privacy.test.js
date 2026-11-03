import test from 'node:test';
import assert from 'node:assert/strict';
import {createProductionApi} from '../src/production.js';
import {createRmp} from '../src/rmp.js';
const school='pasadena-city-college',id='00000000-0000-0000-0000-000000000001';
const person={name:'Example Instructor',provisional:false};
const candidate={id:'1',name:person.name};
const checked_at=new Date().toISOString();
const teacher={id:btoa('Teacher-1'),legacyId:1,firstName:'Example',lastName:'Instructor',school:{id:btoa('School-2649'),legacyId:2649},ratings:{edges:[],pageInfo:{hasNextPage:false}}};
const source=o=>Response.json({data:JSON.parse(o.body).query.includes('BYESearch')?{search:{teachers:{edges:[{node:teacher}],pageInfo:{hasNextPage:false}}}}:{node:teacher}});

// A shared cache backed by the bye_rmp RPC contract: fresh hits return data, misses lease and publish.
function sharedCache(entries=new Map()){
 const rpc=[];
 return {entries,rpc,control:async(action,p)=>{assert.equal(p.user_id,'private-student');return {role:'reader'}},request:async(path,q,o)=>{
  if(path==='bye_instructors')return [person];if(path==='bye_rmp_settings')return [{enabled:true}];
  if(path==='bye_rmp_cache')return entries.has(q.key.slice(3))?[entries.get(q.key.slice(3))]:[];
  if(path!=='rpc/bye_rmp')throw Error('Unexpected request '+path);
  const {action,p}=o.body;rpc.push(action);
  if(action==='cache')return entries.get(p.key)??{token:'cache-lease'};
  if(action==='publish')entries.set(p.key,{data:p.data,checked_at});
  return action==='acquire'?{token:'slot'}:{};
 }};
}

test('opening an uncached professor fetches once, later readers share the cache, and refresh never contacts RMP',async()=>{
 const cache=sharedCache(),upstream=[];
 const handler=createProductionApi({url:'https://project.supabase.co',secret:'server-secret',publishableKey:'public',pepper:'a'.repeat(32),allowedOrigin:'https://bye.test',repository:cache,
  fetcher:async(url,o)=>{if(String(url)==='https://project.supabase.co/auth/v1/user'){assert.equal(o.headers.authorization,'Bearer private-jwt');return Response.json({id:'private-student'})}upstream.push(String(url));return source(o)}});
 const call=(operation,body)=>handler(new Request(`https://bye.test/v1/schools/${school}/instructors/${id}/rmp/${operation}`,{method:'POST',headers:{authorization:'Bearer private-jwt',cookie:'private-cookie','x-forwarded-for':'192.0.2.44',origin:'https://bye.test','content-type':'application/json'},body:JSON.stringify(body)}));
 // The refresh button only re-reads the cache, so nothing cached means 409 and no source contact.
 let r=await call('refresh',{profile_id:'1'});assert.equal(r.status,409);assert.deepEqual(upstream,[]);assert.deepEqual(cache.rpc,[]);
 r=await call('profile',{});assert.equal(r.status,200);assert.equal((await r.json()).data.profile.id,'1');assert.equal(r.headers.get('access-control-allow-origin'),'https://bye.test');
 assert.equal(upstream.length,2);assert.ok(upstream.every(u=>u==='https://www.ratemyprofessors.com/graphql'));
 for(const operation of ['profile','candidates','refresh']){r=await call(operation,operation==='refresh'?{profile_id:'1'}:{});assert.equal(r.status,200);}
 assert.equal(upstream.length,2);
});

test('source requests contain only fixed headers and professor query variables, even with hostile incoming metadata',async()=>{
 const seen=[];
 const repo={request:async(path,q,o)=>{if(path==='bye_instructors')return [person];const {action}=o.body;return action==='cache'?{token:'private-job-id'}:action==='acquire'?{token:'private-slot-id'}:{}}};
 const rmp=createRmp(repo,{fetcher:async(url,o)=>{seen.push({url,o});return source(o)}});
 await rmp(new Request('https://bye.test/?student_id=private-student',{headers:{authorization:'Bearer private-jwt',cookie:'private-cookie','x-forwarded-for':'192.0.2.44','x-real-ip':'192.0.2.44'},method:'POST',body:'private-enrollment'}),school,id,'profile',{cacheOnly:false});
 assert.equal(seen.length,2);
 for(const {url,o} of seen){assert.equal(url,'https://www.ratemyprofessors.com/graphql');assert.equal(o.method,'POST');assert.equal(o.redirect,'error');assert.deepEqual(Object.keys(o.headers).sort(),['Accept','Content-Type','User-Agent']);assert.deepEqual(Object.keys(JSON.parse(o.body)).sort(),['query','variables']);const wire=JSON.stringify({url,headers:o.headers,body:o.body});for(const secret of ['private-jwt','private-student','private-cookie','192.0.2.44','private-enrollment','private-job-id','private-slot-id',id])assert.ok(!wire.includes(secret));}
 assert.deepEqual(JSON.parse(seen[0].o.body).variables,{query:{text:person.name,schoolID:btoa('School-2649')},count:20,cursor:null});
 assert.deepEqual(JSON.parse(seen[1].o.body).variables,{id:btoa('Teacher-1'),count:20,cursor:null,courseFilter:null});
});

test('cache-only reads serve data up to a year, mark it older after six months and never contact RMP',async()=>{
 for(const days of [181,366]){const repo={request:async(path)=>{if(path==='bye_instructors')return [person];if(path==='bye_rmp_settings')return [{enabled:true}];if(path==='bye_rmp_cache')return [{data:{candidates:[candidate],complete:true},checked_at:new Date(Date.now()-days*86400000).toISOString()}];throw Error('No mutation permitted')}};
 const run=createRmp(repo,{fetcher:async()=>{throw Error('No source permitted')}});
 if(days===181){const d=await run(new Request('https://bye.test'),school,id,'candidates');assert.equal(d.stale,true);}else await assert.rejects(run(new Request('https://bye.test'),school,id,'candidates'),{code:'rmp_cache_miss'});
 }
});
