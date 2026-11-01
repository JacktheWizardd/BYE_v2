import {apiTiming} from './performance';
import {createClient} from '@supabase/supabase-js';
export const auth=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,{auth:{storageKey:import.meta.env.VITE_BENCHMARK==='true'?'bye-benchmark-auth':'bye-web-auth',persistSession:true,autoRefreshToken:true}});
export class ApiError extends Error{constructor(public status:number,public code:string,message:string,public retryAfter=60){super(message)}}
export async function api<T>(path:string,signal?:AbortSignal,body?:unknown,retry=true):Promise<T>{
 const began=performance.now();const {data:{session}}=await auth.auth.getSession();const sessionMs=performance.now()-began;
 if(!session)throw new ApiError(401,'unauthorized','Enter your invite code to continue.');
 const timeout=AbortSignal.timeout(35_000);
 const requestSignal=signal?AbortSignal.any([signal,timeout]):timeout;
 const r=await fetch(import.meta.env.VITE_API_BASE+path+(import.meta.env.VITE_BENCHMARK==='true'?(path.includes('?')?'&':'?')+'bye_benchmark=cache-only':''),{method:body===undefined?'GET':'POST',signal:requestSignal,headers:{Authorization:`Bearer ${session.access_token}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 if(r.status===401&&retry){const {error}=await auth.auth.refreshSession();if(!error)return api(path,signal,body,false)}
 apiTiming(path.includes('/rmp/')?'rmp-'+path.split('/rmp/')[1].split('?')[0]:path.includes('/sections')?'sections':path.includes('/courses')?'search':path.includes('/terms')?'semesters':path==='/me'?'me':'schools',began,sessionMs,r.status,r.headers.get('server-timing'));
 const value=await r.json();if(!r.ok){const e=new ApiError(r.status,value.error?.code??'request_failed',value.error?.message??'Request failed.',Number(r.headers.get('retry-after'))||60);if(e.status===401||e.code==='access_required')window.dispatchEvent(new Event('bye-access-lost'));throw e}return value;
}
export async function all<T>(path:string,signal?:AbortSignal):Promise<T[]>{
 const result:T[]=[],seen=new Set<string>();let cursor:string|null=null;
 for(let page=0;page<250;page++){
  const p:{data:T[],next_cursor:string|null}=await api<{data:T[],next_cursor:string|null}>(path+(path.includes('?')?'&':'?')+'limit=100'+(cursor?'&cursor='+encodeURIComponent(cursor):''),signal);
  if(!Array.isArray(p.data)||p.data.length>100||(p.next_cursor!==null&&typeof p.next_cursor!=='string'))throw new ApiError(502,'invalid_page','The schedule response was incomplete. Please try again.');
  result.push(...p.data);cursor=p.next_cursor;
  if(cursor===null)return result;
  if(!cursor||seen.has(cursor))throw new ApiError(502,'invalid_page','The schedule response repeated a page. Please try again.');
  seen.add(cursor);
 }
 throw new ApiError(502,'invalid_page','The schedule response exceeded its page limit. Please try again.');
}
export function sourceStatus(status:string){return ({O:'Open',C:'Closed',W:'Waitlist'} as Record<string,string>)[status]??`Source status: ${status}`}
export type School={id:string,name:string,status:string};export type Term={id:string,name:string,imported?:boolean,import_state?:string};export type Course={id:string,code:string,title:string};
export type Meeting={days:number[],start_time:string|null,end_time:string|null,start_date:string|null,end_date:string|null,timezone:string,format:string|null,format_code?:string|null,room:string|null,building:string|null};
export type Section={id:string,course_id:string,units:number|null,instructors:{id:string,name:string,provisional:boolean}[],meetings:Meeting[],availability:{seats_open:number|null,capacity:number|null,waitlist_count:number|null,waitlist_capacity?:number|null,source_status:string|null,as_of:string}|null};
export function delivery(s:Section){
 const codes=s.meetings.map(m=>m.format_code?.toUpperCase());
 if(!codes.length||codes.some(c=>!c))return 'Format not announced';
 if(codes.every(c=>c==='OD')&&s.meetings.every(m=>!m.days.length&&!m.start_time&&!m.end_time))return 'Online · async';
 if(codes.every(c=>['OD','OL','OS','ON'].includes(c!)))return codes.every(c=>c==='OD')?'Format not announced':'Online · live';
 if(codes.every(c=>['OD','OL','OS','ON','HY'].includes(c!))&&codes.includes('HY'))return 'Hybrid';
 const physical=s.meetings.every(m=>['L','B','LL','BLR'].includes(m.format_code??'')&&/^(Lecture|Lab|Lecture\/Lab|Clinical Lab|Learning Lab|Activity)$/.test(m.format??'')&&!!m.building&&!/online|assignment|arranged/i.test(m.building)&&!!m.days.length&&!!m.start_time);
 if(physical)return 'In person';
 return 'Format not announced';
}
export function fits(s:Section,days:number[]){return !days.length||delivery(s)==='Online · async'||s.meetings.length>0&&s.meetings.every(m=>m.days.length>0&&m.days.every(d=>days.includes(d)))}
export function seatSummary(sections:Section[]){const unique=[...new Map(sections.map(s=>[s.id,s])).values()];return {count:unique.some(s=>s.availability?.seats_open==null)?null:unique.reduce((n,s)=>n+s.availability!.seats_open!,0),stale:unique.some(s=>!s.availability||!Number.isFinite(Date.parse(s.availability.as_of))||Date.now()-Date.parse(s.availability.as_of)>=300000)}}

export function groups(sections:Section[]){const map=new Map<string,{id:string,name:string,sections:Section[]}>();for(const s of sections){for(const p of s.instructors.length?s.instructors:[{id:'tba',name:'Instructor to be announced'}]){if(!map.has(p.id))map.set(p.id,{...p,name:/^(staff|tba|to be announced)$/i.test(p.name)?'Instructor to be announced':p.name,sections:[]});const g=map.get(p.id)!;if(!g.sections.some(x=>x.id===s.id))g.sections.push(s)}}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name))}
