import type {Section} from './api';
export const SYNC_FRESH_MS=300000;
export const fold=(s:string)=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
export function nameMatches(name:string,query:string){const words=fold(name).split(/\s+/);return fold(query).trim().split(/\s+/).every(part=>words.some(w=>w.startsWith(part)))}
export function seatState(open:number|null,cap:number|null,wait:number|null,waitCap:number|null=null){
 if(open==null||cap==null||cap<=0||open>cap)return {kind:'unknown',label:'Seat count unavailable',width:0,taken:null};
 const width=Math.max(0,Math.min(100,Math.round(100*(cap-open)/cap)));
 if(open<=0)return {kind:'bad',label:`Full · waitlist ${wait??'unavailable'}${waitCap==null?'':` of ${waitCap}`}`,width:100,taken:cap};
 return {kind:open<=2?'bad':open<=5?'warn':'ok',label:open<=2?`Only ${open} seat${open===1?'':'s'} left`:open<=5?'Almost full':'Plenty of seats',width,taken:cap-open};
}
export type SyncState={kind:string,label:string,detail:string};
export function syncState(sections:Section[],failed=false,now=Date.now()):SyncState{
 if(!sections.length)return {kind:'unknown',label:'Schedule not checked yet',detail:'No schedule check is available for this course.'};
 const times=sections.map(s=>Date.parse(s.availability?.as_of??''));const fresh=times.filter(t=>Number.isFinite(t)&&t<=now&&now-t<SYNC_FRESH_MS).length;
 const known=times.filter(t=>Number.isFinite(t)&&t<=now),oldest=known.length?Math.min(...known):null;
 const time=oldest==null?'time unavailable':new Date(oldest).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
 if(failed)return {kind:'stale',label:'Schedule out of sync',detail:`Couldn’t reload saved counts · last known check ${time}.`};
 if(fresh===sections.length)return {kind:'fresh',label:'Schedule up to date',detail:`Seat counts for all sections · ${time} · ${Math.floor((now-oldest!)/60000)} min ago`};
 if(fresh)return {kind:'partial',label:'Some sections behind',detail:`${sections.length-fresh} of ${sections.length} sections have old or unavailable check times · Refresh all to retry`};
 return {kind:'stale',label:'Schedule out of sync',detail:`Seat counts are old or unchecked · last known check ${time}`};
}
export function orderLoaded<T extends {date:string|null,rating:number|null}>(rows:T[],order:string){return [...rows].sort((a,b)=>{if(order==='All')return 0;const av=order==='Most recent'?Date.parse(a.date??''):a.rating,bv=order==='Most recent'?Date.parse(b.date??''):b.rating;const validA=av!=null&&Number.isFinite(av),validB=bv!=null&&Number.isFinite(bv);return Number(!validA)-Number(!validB)||(validA&&validB?(order==='Lowest'?av!-bv!:bv!-av!):0)})}

export type RefreshState={imported:boolean,status:string,last_failure:string|null,last_successful_check:string|null,next_eligible_at:string|null,import_state?:string,server_observed_at?:string,eligible_jobs_ahead?:number,global_next_fetch_at?:string|null,retry_not_before?:string|null,attempts?:number};
export function coordinatedSync(sections:Section[],failed:boolean,now:number,refresh?:RefreshState|null):SyncState{
 const state=syncState(sections,failed,now);
 if(!sections.length)return {...state,label:'Not checked yet'};
 if(failed)return {...state,label:'Couldn’t reload saved counts'};
 if(state.kind==='fresh')return {...state,label:'Up to date'};
 if(refresh?.status==='running')return {...state,label:'Checking PCC',detail:state.detail+' · Checking PCC; previous counts remain displayed.'};
 if(refresh?.status==='queued')return {...state,label:'Update queued',detail:state.detail+' · Shared PCC update queued.'};
 return {...state,label:sections.length?'Older counts':'Not checked yet',detail:state.detail+(refresh?.last_failure?' · The last PCC check failed.':'')};
}

// Semester status describes the worker's last successful check, not every section.
export function semesterSync(refresh:RefreshState|null,failed=false,now=Date.now()):SyncState{
 const checked=Date.parse(refresh?.last_successful_check??'');
 const known=Number.isFinite(checked)&&checked<=now;
 const detail=known?'Semester last checked '+new Date(checked).toLocaleString()+'.':'No successful semester check is recorded yet.';
 if(failed)return {kind:'stale',label:'Couldn’t reload schedule status',detail:detail+' Previous status retained.'};
 if(!known)return {kind:'unknown',label:refresh?.status==='running'?'Checking PCC':refresh?.status==='queued'?'Update queued':'Not checked yet',detail};
 if(refresh?.status==='running'||refresh?.status==='queued')return {kind:'partial',label:refresh.status==='running'?'Checking PCC':'Update queued',detail};
 if(now-checked<SYNC_FRESH_MS)return {kind:'fresh',label:'Semester checked',detail};
 return {kind:'stale',label:'Older semester check',detail:detail+(refresh?.last_failure?' The last PCC check failed.':'')};
}
export function statusPollDelay(state:Pick<SyncState,'kind'>){
 return state.kind==='fresh'?1800000:state.kind==='partial'?600000:state.kind==='stale'?300000:5000;
}

export function importLabel(state?:string){return state==='ready'?'':state==='queued'?'Queued':state==='running'?'Importing':state==='failed'?'Import failed':'Preparing'}

// A successful BYE read proves connectivity, never PCC freshness.
export function connectionSync(observedAt:number|null,failed=false,checking=false,online=true):SyncState{
 if(!online)return {kind:'partial',label:'Offline',detail:'This device is offline. Saved results remain available.'};
 if(checking)return {kind:'partial',label:'Checking BYE…',detail:'Reading BYE’s Supabase-backed API.'};
 if(failed)return {kind:'stale',label:'BYE read failed',detail:'Couldn’t complete the BYE API read. Previously loaded data is retained.'};
 if(observedAt!==null)return {kind:'fresh',label:'Connected to BYE',detail:'The latest BYE API read succeeded. This does not confirm that PCC data is fresh.'};
 return {kind:'unknown',label:'Not checked yet',detail:'No successful BYE status read on this device yet.'};
}
