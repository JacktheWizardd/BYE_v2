import {ApiError} from './errors.js';
const fail=()=>{throw new ApiError(400,'invalid_plan','Invalid weekly Plan backup.');};
/** Sections a student may tag as watching in one semester. Watching is tentative: it is never part of the Plan itself. */
export const WATCH_LIMIT=30;
// One saved section. The Plan's own sections and the watching list follow exactly the same rules.
function validateSections(list,max){
 if(!Array.isArray(list)||list.length>max)fail();const ids=new Set();
 for(const s of list){if(!s||typeof s.id!=='string'||!/^\d{5}$/.test(s.id)||ids.has(s.id)||typeof s.course_id!=='string'||typeof s.code!=='string'||typeof s.title!=='string'||s.code.length>100||s.title.length>500||!Array.isArray(s.meetings)||!Array.isArray(s.instructors)||s.meetings.length>100)fail();ids.add(s.id);
 if(Object.keys(s).some(k=>!['id','course_id','code','title','units','meetings','instructors'].includes(k)))fail();
 for(const who of s.instructors)if(!who||typeof who.id!=='string'||typeof who.name!=='string'||who.name.length>300||Object.keys(who).some(k=>!['id','name','provisional'].includes(k)))fail();
 for(const m of s.meetings){if(!m||!Array.isArray(m.days)||Object.keys(m).some(k=>!['days','start_time','end_time','start_date','end_date','timezone','format','format_code','room','building','campus'].includes(k))||m.days.some(d=>!Number.isInteger(d)||d<1||d>7)||!['start_time','end_time'].every(k=>m[k]===null||typeof m[k]==='string'&&/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(m[k])))fail();for(const k of ['start_date','end_date'])if(m[k]!==null&&(typeof m[k]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m[k])))fail();for(const k of ['timezone','format','format_code','room','building','campus'])if(m[k]!=null&&(typeof m[k]!=='string'||m[k].length>300))fail();}
 }
}
export function validateWeeklyPlans(value){
 if(!Array.isArray(value)||value.length>50)fail();
 const keys=new Set();
 return value.map(p=>{
 if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['school_id','term_id','sections','study','weekend','watching'].includes(k))||!['school_id','term_id'].every(k=>typeof p[k]==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p[k]))||!Array.isArray(p.sections)||p.sections.length>100||typeof p.weekend!=='boolean'||!p.study||Array.isArray(p.study)||typeof p.study!=='object')fail();
 const key=p.school_id+':'+p.term_id;if(keys.has(key))fail();keys.add(key);
 validateSections(p.sections,100);
 // Optional, so Plans saved before Watches existed (and older backups) stay valid as they are.
 if(p.watching!==undefined)validateSections(p.watching,WATCH_LIMIT);
 for(const [k,v] of Object.entries(p.study))if(!p.sections.some(s=>s.course_id===k)||!Number.isFinite(v)||v<0||v>40||v*2%1)fail();
 if(JSON.stringify(p).length>200000)fail();return structuredClone(p);
 });
}
/**
 * Replaces each saved section's units, meetings and instructors with the school's current ones, for Plan sections and
 * watched sections alike, so neither list shows a stale time. `lookup(school, term, id)` resolves the current section.
 * A section the school no longer lists keeps its saved snapshot; its `school:term:id` key is returned so the app can say so.
 * `strict` (used when saving) rejects a section filed under a different course than the school reports.
 */
export async function refreshPlans(plans,lookup,strict=false){
 const missing=new Set();
 for(const plan of plans)for(const list of [plan.sections,plan.watching??[]])for(let i=0;i<list.length;i++){
  const entry=list[i],current=await lookup(plan.school_id,plan.term_id,entry.id);
  if(!current){missing.add([plan.school_id,plan.term_id,entry.id].join(':'));continue}
  if(strict&&current.course_id!==entry.course_id)throw new ApiError(400,'invalid_plan','Section and course do not match.');
  list[i]={...entry,units:current.units,meetings:current.meetings,instructors:current.instructors};
 }
 return [...missing];
}
