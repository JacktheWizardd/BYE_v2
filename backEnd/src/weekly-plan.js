import {ApiError} from './errors.js';
export function validateWeeklyPlans(value){
 const fail=()=>{throw new ApiError(400,'invalid_plan','Invalid weekly Plan backup.');};
 if(!Array.isArray(value)||value.length>50)fail();
 const keys=new Set();
 return value.map(p=>{
 if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['school_id','term_id','sections','study','weekend'].includes(k))||!['school_id','term_id'].every(k=>typeof p[k]==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(p[k]))||!Array.isArray(p.sections)||p.sections.length>100||typeof p.weekend!=='boolean'||!p.study||Array.isArray(p.study)||typeof p.study!=='object')fail();
 const key=p.school_id+':'+p.term_id;if(keys.has(key))fail();keys.add(key);const ids=new Set();
 for(const s of p.sections){if(!s||typeof s.id!=='string'||!/^\d{5}$/.test(s.id)||ids.has(s.id)||typeof s.course_id!=='string'||typeof s.code!=='string'||typeof s.title!=='string'||s.code.length>100||s.title.length>500||!Array.isArray(s.meetings)||!Array.isArray(s.instructors)||s.meetings.length>100)fail();ids.add(s.id);
 if(Object.keys(s).some(k=>!['id','course_id','code','title','units','meetings','instructors'].includes(k)))fail();
 for(const who of s.instructors)if(!who||typeof who.id!=='string'||typeof who.name!=='string'||who.name.length>300||Object.keys(who).some(k=>!['id','name','provisional'].includes(k)))fail();
 for(const m of s.meetings){if(!m||!Array.isArray(m.days)||Object.keys(m).some(k=>!['days','start_time','end_time','start_date','end_date','timezone','format','format_code','room','building','campus'].includes(k))||m.days.some(d=>!Number.isInteger(d)||d<1||d>7)||!['start_time','end_time'].every(k=>m[k]===null||typeof m[k]==='string'&&/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(m[k])))fail();for(const k of ['start_date','end_date'])if(m[k]!==null&&(typeof m[k]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(m[k])))fail();for(const k of ['timezone','format','format_code','room','building','campus'])if(m[k]!=null&&(typeof m[k]!=='string'||m[k].length>300))fail();}
 }
 for(const [k,v] of Object.entries(p.study))if(!p.sections.some(s=>s.course_id===k)||!Number.isFinite(v)||v<0||v>40||v*2%1)fail();
 if(JSON.stringify(p).length>200000)fail();return structuredClone(p);
 });
}
