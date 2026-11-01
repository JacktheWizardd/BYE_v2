import {validateWeeklyPlans} from './weekly-plan.js';
import {validateEducationPlan} from './education-plan.js';
import {createRmp} from './rmp.js';
import { createApi } from './api.js';
import { createConnectors, detectConnector } from './connectors.js';
import { SupabaseRepository } from './repository.js';
import { ApiError } from './errors.js';

export class ProductionRepository extends SupabaseRepository {
  control(action, p = {}) { return this.request('rpc/bye_control', {}, { method: 'POST', body: { action, p } }); }
  requestRefresh(school,term){return this.request('rpc/bye_request_refresh',{}, {method:'POST',body:{p_school:school,p_term:term}});}
  semesters(action,p={}) { return this.request('rpc/bye_semesters',{}, {method:'POST',body:{action,p}}); }
  enqueue(school_id, term_id) { return this.control('enqueue', { school_id, term_id }); }
  touch(school_id, term_id) { return this.control('touch', { school_id, term_id }); }
}
export async function digest(value, pepper) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
// Reader invites always include a letter, distinct from numeric owner codes.
export function generateInviteCode(bytes=crypto.getRandomValues(new Uint8Array(8))){const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',letters=alphabet.replace(/[0-9]/g,'');let raw=[...bytes].map(n=>alphabet[n%alphabet.length]).join('');if(!/[A-Z]/.test(raw))raw=letters[bytes[0]%letters.length]+raw.slice(1);return raw;}
function json(data, status = 200) { return Response.json(data, { status, headers: { 'cache-control': 'no-store' } }); }
async function input(request, maxBytes=8192) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(400, 'invalid_request', 'Use JSON.');
  const reader = request.body?.getReader(); if (!reader) throw new ApiError(400, 'invalid_request', 'Provide JSON.');
  let length=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>maxBytes){await reader.cancel();throw new ApiError(413,'body_too_large','Body too large.');}chunks.push(value);}
  try {const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const data=JSON.parse(new TextDecoder().decode(bytes));if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data;}
  catch {throw new ApiError(400,'invalid_request','Invalid JSON.');}
}
export function createProductionApi({ url, secret, publishableKey, pepper, allowedOrigin, fetcher = fetch, repository = new ProductionRepository(url,secret,fetcher), benchmarkUserId = null }) {
  if (!pepper || pepper.length < 32) throw new Error('BYE_INVITE_PEPPER must have at least 32 characters.');
  const connectors=createConnectors({fetcher});

  return async request => {
    let result, measured=false;const started=performance.now(),durations={};
    const timed=async(name,work)=>{if(!benchmarkUserId)return work();const start=performance.now();try{return await work()}finally{durations[name]=(durations[name]||0)+performance.now()-start}};
    // Each request owns its repository wrapper; concurrent readers cannot mix timings.
    const baseRepository=repository;
    const scoped=Object.create(baseRepository);
    scoped.request=(...args)=>timed('db',()=>args[0]==='bye_rmp_cache'||args[0]==='rpc/bye_rmp'&&['cache','publish','abandon'].includes(args[2]?.body?.action)?timed('rmp_cache',()=>baseRepository.request(...args)):baseRepository.request(...args));
    const rmp=createRmp(scoped,{fetcher,measure:timed});
    try {
      if(request.method==='OPTIONS') result=new Response(null,{status:204});
      else {
        const authorization=request.headers.get('authorization');
        if(!authorization?.startsWith('Bearer ')) throw new ApiError(401,'unauthorized','A valid session is required.');
        const auth=await timed('auth',()=>fetcher(new URL('/auth/v1/user',url),{headers:{apikey:publishableKey,authorization},signal:AbortSignal.timeout(10000)}));
        if(!auth.ok)throw new ApiError(401,'unauthorized','A valid session is required.');
        const user=await auth.json();if(!user.id)throw new ApiError(401,'unauthorized','Invalid user.');
        const path=new URL(request.url).pathname;
        measured=!!benchmarkUserId&&[benchmarkUserId].flat().includes(user.id);
        const requestedBenchmark=new URL(request.url).searchParams.get('bye_benchmark');
        if(requestedBenchmark&&!measured)throw new ApiError(403,'benchmark_disabled','Benchmark mode is not enabled for this reader.');
        const cacheOnly=measured&&requestedBenchmark==='cache-only';
        if(path==='/v1/auth/invites/redeem' && request.method==='POST') {
          const data=await input(request);
          const code=typeof data.code==='string'?data.code.replace(/-/g,'').toUpperCase():'';
          // Use the gateway-injected address only. Never trust a client device ID.
          const actor=await digest(request.headers.get('x-forwarded-for')?.split(',')[0].trim() || user.id,pepper);
          const redeemed=await scoped.control('redeem',{user_id:user.id,actor,hash:await digest(code,pepper)});
          if(redeemed.error)throw new ApiError(redeemed.error==='rate_limited'?429:400,redeemed.error,'Invite could not be redeemed.');
          result=json({data:redeemed});
        } else {
          const member=await timed('membership',()=>scoped.control('membership',{user_id:user.id}));
          if(!member)throw new ApiError(403,'access_required','An unexpired BYE invitation is required.');
          if(path==='/v1/me' && request.method==='GET') result=json({data:member});
          else if(path==='/v1/me/plan') {
            if(!['GET','POST'].includes(request.method))throw new ApiError(405,'method_not_allowed','Use GET or POST.');
            let plans=null,revision=null;
            if(request.method==='POST'){
              const body=await input(request,1048576);
              if(Object.keys(body).some(k=>!['expected_revision','plans'].includes(k))||!Number.isSafeInteger(body.expected_revision)||body.expected_revision<0)throw new ApiError(400,'invalid_plan','Provide an expected revision.');
              plans=validateWeeklyPlans(body.plans);revision=body.expected_revision;
              for(const plan of plans)for(let i=0;i<plan.sections.length;i++){
                const entry=plan.sections[i],section=await scoped.section(plan.school_id,plan.term_id,entry.id);
                if(section){if(section.course_id!==entry.course_id)throw new ApiError(400,'invalid_plan','Section and course do not match.');plan.sections[i]={...entry,units:section.units,meetings:section.meetings,instructors:section.instructors};}
              }
            }
            const saved=await scoped.request('rpc/bye_weekly_plan',{}, {method:'POST',body:{p_user_id:user.id,p_revision:revision,p_plans:plans}});
            if(saved.error)throw new ApiError(saved.error==='revision_conflict'?409:403,saved.error,saved.error==='revision_conflict'?'Your Plan changed in another tab. Reload before saving.':'Access has ended.');
            const missing=[];
            if(request.method==='GET')for(const plan of saved.data.plans)for(const section of plan.sections){const current=await scoped.section(plan.school_id,plan.term_id,section.id);if(current){section.meetings=current.meetings;section.instructors=current.instructors;section.units=current.units;}else missing.push([plan.school_id,plan.term_id,section.id].join(':'));}
            result=json({...saved,missing_sections:missing});
          }
          else if(path==='/v1/me/education-plan') {
            if(!['GET','POST'].includes(request.method))throw new ApiError(405,'method_not_allowed','Use GET or POST.');
            let revision=null,plan=null;
            if(request.method==='POST'){
              const data=await input(request,1048576);
              if(Object.keys(data).some(k=>!['expected_revision','plan'].includes(k))||!Number.isSafeInteger(data.expected_revision)||data.expected_revision<0)throw new ApiError(400,'invalid_education_plan','Provide an expected revision and a reviewed plan.');
              revision=data.expected_revision;plan=validateEducationPlan(data.plan);
            }
            const saved=await scoped.request('rpc/bye_education_plan',{}, {method:'POST',body:{p_user_id:user.id,p_action:request.method==='GET'?'read':'save',p_revision:revision,p_plan:plan}});
            if(saved.error)throw new ApiError(saved.error==='revision_conflict'?409:saved.error==='access_required'?403:400,saved.error,saved.error==='revision_conflict'?'The saved plan changed. Reload it before replacing it.':saved.error==='access_required'?'An unexpired BYE invitation is required.':'The education plan could not be saved.');
            result=json(saved);
          }
          else if(/^\/v1\/schools\/[a-z0-9-]+\/instructors\/[0-9a-f-]{36}\/rmp\/(candidates|profile|reviews|refresh)$/.test(path)&&(request.method==='GET'&&!path.endsWith('/refresh')||request.method==='POST'&&path.endsWith('/refresh'))){const bits=path.split('/');result=json({data:await timed('rmp',()=>rmp(request,bits[3],bits[5],bits[7],{cacheOnly}))});}
          else if(path.startsWith('/v1/admin/')) {
            if(member.role!=='owner')throw new ApiError(403,'forbidden','Owner access required.');
            if(path==='/v1/admin/owner-code' && request.method==='POST'){
              const data=await input(request),code=typeof data.code==='string'?data.code.replace(/-/g,''):'';
              if(!/^[0-9]{8}$/.test(code))throw new ApiError(400,'invalid_request','Use an eight-digit owner code.');
              const configured=await scoped.control('set_owner_code',{user_id:user.id,hash:await digest(code,pepper)});
              if(configured.error)throw new ApiError(configured.error==='forbidden'?403:409,configured.error,'Owner code could not be configured.');
              result=json({data:configured});
            } else if(path==='/v1/admin/invites' && request.method==='POST'){
              const data=await input(request);if(data.note!==undefined && (typeof data.note!=='string'||data.note.length>160))throw new ApiError(400,'invalid_request','Invalid note.');
              const raw=generateInviteCode();
              const saved=await scoped.request('bye_invites',{}, {method:'POST',prefer:'return=representation',body:{code_hash:await digest(raw,pepper),note:data.note??null}});
              result=json({data:{id:saved[0].id,code:raw.slice(0,4)+'-'+raw.slice(4)}},201);
            } else if(path==='/v1/admin/invites' && request.method==='GET'){
              const rows=[];for(let offset=0;offset<100000;offset+=100){const page=await scoped.request('bye_invites',{select:'id,note,created_at,used_at,revoked_at',deleted_at:'is.null',order:'created_at.desc,id.desc',limit:100,offset});rows.push(...page);if(page.length<100)break;}result=json({data:rows});
            }
            else if(/^\/v1\/admin\/invites\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/delete$/.test(path)&&request.method==='POST'){
              const removed=await scoped.request('rpc/bye_delete_invite',{}, {method:'POST',body:{p_owner:user.id,p_id:path.split('/')[4]}});
              if(removed.error)throw new ApiError(403,'forbidden','Owner access required.');
              result=json({data:removed});
            }
            else if(/^\/v1\/admin\/invites\/[0-9a-f-]{36}\/revoke$/.test(path)&&request.method==='POST')result=json({data:await scoped.control('revoke_invite',{id:path.split('/')[4]})});
            else if(/^\/v1\/admin\/jobs\/[0-9a-f-]{36}$/.test(path)&&request.method==='GET'){
              const rows=await scoped.request('bye_jobs',{select:'*',id:`eq.${path.split('/')[4]}`,limit:1});if(!rows.length)throw new ApiError(404,'not_found','Job not found.');result=json({data:rows[0]});
            } else throw new ApiError(404,'not_found','Endpoint not found.');
          } else {
            const match=path.match(/^\/v1\/schools\/([a-z0-9-]+)\/(test-source|activate|disable)$/);
            if(match && request.method==='POST'){
              if(member.role!=='owner')throw new ApiError(403,'forbidden','Owner access required.');
              const school=await scoped.school(match[1]);if(!school)throw new ApiError(404,'not_found','School not found.');
              if(match[2]==='disable'){await scoped.request('bye_schools',{id:`eq.${school.id}`},{method:'PATCH',body:{status:'disabled'}});result=json({data:{status:'disabled'}});}
              else {
                const connectorId=detectConnector(school.schedule_url),connector=connectors.get(connectorId);
                if(!connector)throw new ApiError(409,'connector_required','A verified connector is required.');
                const data=await input(request),terms=await connector.terms(),term=terms.find(t=>t.id===data.term_id);
                if(!term)throw new ApiError(400,'invalid_request','Select a published semester.');
                // Activation queues the same validated import used by normal owner imports.
                if(match[2]==='activate'){
                  await scoped.request('bye_schools',{id:`eq.${school.id}`},{method:'PATCH',body:{connector:connectorId,capabilities:connector.capabilities,status:'setup_required'}});
                  result=json({data:await scoped.enqueue(school.id,term.id)},202);
                } else {result=json({data:await scoped.control('enqueue',{school_id:school.id,term_id:term.id,kind:'preview'})},202);}
              }
            } else result=await createApi({repository:scoped,connectors,authorize:async()=>member})(request);
          }
        }
      }
    }catch(error){result=json({error:{code:error instanceof ApiError?error.code:'service_unavailable',message:error instanceof ApiError?error.message:'The request could not be completed.'}},error instanceof ApiError?error.status:503);if(error.retryAfter)result.headers.set('retry-after',String(error.retryAfter));}
    const origin=request.headers.get('origin');
    const origins=Array.isArray(allowedOrigin)?allowedOrigin:[allowedOrigin];
    if(allowedOrigin)result.headers.set('vary','Origin');
    if(origin&&origins.includes(origin)){result.headers.set('access-control-allow-origin',origin);result.headers.set('vary','Origin');result.headers.set('access-control-allow-methods','GET, POST, OPTIONS');result.headers.set('access-control-allow-headers','Authorization, Content-Type');result.headers.set('access-control-expose-headers','Retry-After, Server-Timing');}
    if(measured){durations.total=performance.now()-started;result.headers.set('Server-Timing',Object.entries(durations).map(([k,v])=>`${k};dur=${v.toFixed(2)}`).join(', '));}
    if(result.status===429&&!result.headers.has('retry-after'))result.headers.set('retry-after','60');return result;
  };
}
