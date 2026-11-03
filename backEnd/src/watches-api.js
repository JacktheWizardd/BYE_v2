import {validateWatchesState} from './watches-validation.js';
export {validateWatchesState} from './watches-validation.js';
import {validateWeeklyPlans} from './weekly-plan.js';
import {ApiError} from './errors.js';
import {validateEducationPlan} from './education-plan.js';
import {reference,planReferences} from './education-references.js';
import {entries,effectiveStatus,evaluateRule,allocateAreas,ucPattern,termKey,alias} from './education-checks.js';
const fail=(message='Invalid Watches data.')=>{throw new ApiError(400,'invalid_watches',message)};
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fields=(o,allowed)=>{if(!obj(o)||Object.keys(o).some(k=>!allowed.includes(k)))fail()};
const text=(s,max=160)=>{if(typeof s!=='string'||s.length>max||/[\u0000-\u001f]/.test(s))fail();return s.trim()};

function checked(result){if(result?.error)throw new ApiError(['revision_conflict','archive_limit','client_upgrade_required'].includes(result.error)?409:result.error==='access_required'?403:400,result.error,result.error==='revision_conflict'?'The saved data changed. Reload before trying again.':result.error==='access_required'?'Access has ended.':'The change could not be saved.');return result;}
async function sectionDates(repository,user,plan){
 if(!plan?.match_school_id)return {};
 const [weeks,terms]=await Promise.all([repository.request('bye_weekly_plans',{user_id:'eq.'+user,select:'plans',limit:1}),repository.request('bye_terms',{school_id:'eq.'+plan.match_school_id,select:'id,name',limit:250})]);const result={},all=entries(plan);
 for(const e of all){if(e.kind!=='course'||!termKey(e.term)||all.filter(other=>alias(other.code)===alias(e.code)&&termKey(other.term)===termKey(e.term)).length!==1)continue;
 const matches=(weeks[0]?.plans??[]).filter(w=>w.school_id===plan.match_school_id&&terms.some(t=>t.id===w.term_id&&termKey({label:t.name,year:Number(t.name.match(/20\d{2}/)?.[0])||null})===termKey(e.term))).flatMap(w=>w.sections.filter(s=>alias(s.code)===alias(e.code)));
 if(matches.length===1&&matches[0].meetings.length&&matches[0].meetings.every(m=>typeof m.end_date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(m.end_date)))result[e.id]=matches[0].meetings.map(m=>m.end_date).sort().at(-1);
 }return result;
}
export function createWatchesApi(repository,fetcher){
 const rpc=async(user,action,p={})=>checked(await repository.request('rpc/bye_watches',{}, {method:'POST',body:{p_user_id:user,p_action:action,p}}));
 const collection=async(user,action='read',p={})=>checked(await repository.request('rpc/bye_education_collection',{}, {method:'POST',body:{p_user_id:user,p_action:action,p}}));
 return async(path,method,user,input)=>{
  if(path==='/v1/me/education-plan-backup'){
   if(method==='GET')return checked(await repository.request('rpc/bye_education_backup',{}, {method:'POST',body:{p_user_id:user}}));
   if(method!=='POST')throw new ApiError(405,'method_not_allowed','Use GET or POST.');
   fields(input,['expected_revision','expected_plan_id','records','active_index']);if(!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||input.expected_plan_id!==null&&!uuid(input.expected_plan_id)||!Array.isArray(input.records)||input.records.length<1||input.records.length>21||!Number.isInteger(input.active_index)||input.active_index<0||input.active_index>=input.records.length)fail();
   const records=input.records.map(r=>{fields(r,['plan','state']);return {plan:validateEducationPlan(r.plan),state:validateWatchesState(r.state)}});
   return checked(await repository.request('rpc/bye_education_backup',{}, {method:'POST',body:{p_user_id:user,p_revision:input.expected_revision,p_active_id:input.expected_plan_id,p_records:records,p_active_index:input.active_index}}));
  }
  if(path==='/v1/me/backup'&&method==='POST'){fields(input,['expected_revision','plans','professors']);if(!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||!Array.isArray(input.professors)||input.professors.length>200)fail();const professors=input.professors.map(p=>{fields(p,['school_id','instructor_id']);if(!uuid(p.instructor_id)||! /^[a-z0-9-]{1,80}$/.test(p.school_id))fail();return p});const plans=validateWeeklyPlans(input.plans);for(const p of plans)for(let i=0;i<p.sections.length;i++){const s=await repository.section(p.school_id,p.term_id,p.sections[i].id);if(s){if(s.course_id!==p.sections[i].course_id)fail();p.sections[i]={...p.sections[i],units:s.units,meetings:s.meetings,instructors:s.instructors}}}return checked(await repository.request('rpc/bye_restore_weekly_backup',{}, {method:'POST',body:{p_user_id:user,p_revision:input.expected_revision,p_plans:plans,p_professors:professors}}));}
  if(path==='/v1/me/education-plans'){
   if(method==='GET')return collection(user);
   if(method!=='POST')throw new ApiError(405,'method_not_allowed','Use GET or POST.');
   fields(input,['expected_revision','expected_plan_id','mode','plan']);if(!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0||input.expected_plan_id!==null&&!uuid(input.expected_plan_id)||!['save','new'].includes(input.mode))fail();
   const plan=validateEducationPlan(input.plan);if(plan.match_school_id&&!await repository.school(plan.match_school_id))fail('Select a connected schedule school.');
   return collection(user,input.mode,{...input,plan});
  }
  if(path==='/v1/me/watches/professors'&&method==='GET')return rpc(user,'read');
  if(path==='/v1/me/watches'){
   if(method==='POST'){
    fields(input,['action','school_id','instructor_id','ids','plan_id','expected_revision','data']);
    if(['follow','unfollow','restore'].includes(input.action)){if(!uuid(input.instructor_id)||! /^[a-z0-9-]{1,80}$/.test(input.school_id??''))fail();return rpc(user,input.action,{school_id:input.school_id,instructor_id:input.instructor_id})}
    if(input.action==='seen'){if(!Array.isArray(input.ids)||input.ids.length>1000||input.ids.some(id=>!uuid(id)))fail();return rpc(user,'seen',{ids:input.ids})}
    if(input.action==='state'){if(!uuid(input.plan_id)||!Number.isSafeInteger(input.expected_revision)||input.expected_revision<0)fail();return rpc(user,'state',{plan_id:input.plan_id,expected_revision:input.expected_revision,data:validateWatchesState(input.data)})}fail();
   }
   if(method!=='GET')throw new ApiError(405,'method_not_allowed','Use GET or POST.');
   const [saved,plans,schedule]=await Promise.all([rpc(user,'read'),collection(user),repository.request('rpc/bye_watches_schedule',{}, {method:'POST',body:{p_user_id:user}}).then(checked)]);
   const p=plans.data.active?.plan;const calendar=p?.match_school_id==='pasadena-city-college'?(await reference(repository,'calendar',fetcher))?.calendar??{}:{};const cache=await repository.request('bye_rmp_cache',{select:'data,checked_at',key:'like.*\"reviews\"*',limit:1000});for(const prof of saved.data.professors){const matches=cache.filter(c=>c.data?.profile?.name?.trim().toLowerCase()===prof.name.trim().toLowerCase());if(!prof.provisional&&new Set(matches.map(c=>c.data.profile.id)).size===1)prof.rmp=matches[0].data.profile;}const linked=await sectionDates(repository,user,p);const statuses=Object.fromEntries(entries(p).map(e=>[e.id,effectiveStatus(e,e.term,p.match_school_id,saved.data.state.status_overrides,calendar,new Date(),linked[e.id])]));
   const codes=new Set(entries(p).flatMap(e=>[e.code,...(e.options??[]).map(o=>o.code)]).map(alias));
   return {data:{...saved.data,...plans.data,statuses,sections:schedule.data.slice(0,5000),truncated:schedule.data.length>5000,events:saved.data.events.filter(e=>e.school_id===p?.match_school_id&&codes.has(alias(e.course_code)))}};
  }
  if(path==='/v1/me/education-checks'&&method==='GET'){
   const [plans,saved]=await Promise.all([collection(user),rpc(user,'read')]);const plan=plans.data.active?.plan,refs=await planReferences(repository,plan,fetcher);
   const linked=await sectionDates(repository,user,plan);const statuses=Object.fromEntries(entries(plan).map(e=>[e.id,effectiveStatus(e,e.term,plan.match_school_id,saved.data.state.status_overrides,refs.calendar,new Date(),linked[e.id])]));
   const prerequisites=entries(plan).flatMap(e=>e.kind==='course'?[e]:e.kind==='alternative'?(e.options??[]).map(o=>({...e,code:o.code,choice:true})):[]).map(e=>{const course=refs.courses[alias(e.code)];return {entry_id:e.id,code:e.code,term:e.term.label,rules:course?course.rules.map(rule=>({...rule,result:saved.data.state.prereq_overrides.some(o=>o.entry_id===e.id&&o.rule_id===rule.id)?{state:'ready',override:true}:evaluateRule(rule,e,plan,statuses)})):null,source:course?.source,year:course?.year}});
   const ge=refs.ge?{...allocateAreas(plan,refs.ge.areas,statuses),source:refs.ge.source,year:refs.ge.year}:null;
   const transferable=entries(plan).filter(e=>e.kind==='course'&&refs.courses[alias(e.code)]?.uc_transferable&&e.term.basis==='semester'&&e.units!==null&&['planned','enrolled','completed'].includes(statuses[e.id]?.status));
   const units=[...new Map(transferable.map(e=>[alias(e.code),e])).values()].reduce((n,e)=>n+e.units,0);return {data:{plan_id:plans.data.active?.id??null,plan_revision:plans.data.active?.revision??0,statuses,prerequisites,ge,uc_pattern:refs.ge?.uc_areas?{available:true,...ucPattern(plan,refs.ge.uc_areas,statuses)}:{available:false,reason:'UC-E/M/H/B/S course designations are not available from the connected source.'},transferable:{units,qualified:true,reason:'Only verified courses are counted; repeats, limits and grades require review.'},references:{supported:refs.supported,checked_at:refs.checked_at,pending:refs.pending,stale:refs.stale}}};
  }
  const match=path.match(/^\/v1\/schools\/([a-z0-9-]+)\/instructors\/([0-9a-f-]{36})$/);
  if(match&&method==='GET'&&uuid(match[2])){const found=await repository.request('bye_instructors',{school_id:'eq.'+match[1],id:'eq.'+match[2],select:'id,name,school_id,provisional',limit:1});if(!found.length)throw new ApiError(404,'not_found','Instructor not found.');const result=checked(await repository.request('rpc/bye_watches_schedule',{}, {method:'POST',body:{p_user_id:user,p_school:match[1],p_instructor:match[2]}}));const plans=await collection(user),codes=new Set(entries(plans.data.active?.plan).flatMap(e=>[e.code,...(e.options??[]).map(o=>o.code)]).map(alias));return {data:{...found[0],plan_courses:[...new Set(result.data.filter(s=>codes.has(alias(s.code))&&plans.data.active?.plan.match_school_id===match[1]).map(s=>s.code))],sections:result.data.slice(0,5000),truncated:result.data.length>5000}};}
  return null;
 };
}
