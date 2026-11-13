import React,{useState} from 'react';
import {useViewState} from './viewState';
import {Timeline,conflicts,minutes,englishTime,layoutMeetings,WATCH_LIMIT,type Entry,type Week,type PlanStore} from './Plan';
import type {Meeting,Term} from './api';

// Watches: sections a student tagged to try on their week. A tag is saved with the semester's Plan but is never part of
// it: watched sections stay out of the Plan's hours, study rows and CRN list until the student adds them. BYE doesn't
// rank, reorder or pick among them; they are listed in the order they were tagged.
const dayNames=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const sameWeek=(p:Week,school:string,term:string)=>p.school_id===school&&p.term_id===term;
const timeless=(m:Meeting)=>!m.days.length||!m.start_time||!m.end_time;
/** The saved week for a school and semester, or an empty one. */
export const weekOf=(plans:Week[],school:string,term:string):Week=>plans.find(p=>sameWeek(p,school,term))??{school_id:school,term_id:term,sections:[],study:{},weekend:false};
// An empty list is left off entirely, so a week with nothing watched is saved exactly as it was before Watches existed.
const withWatching=(week:Week,list:Entry[]):Week=>{const {watching:_,...rest}=week;return list.length?{...rest,watching:list}:rest};
const put=(plans:Week[],next:Week)=>[...plans.filter(p=>!sameWeek(p,next.school_id,next.term_id)),next];
/** Watched sections that aren't already in the Plan, in the order they were tagged. */
export const watchingOf=(week:Week)=>(week.watching??[]).filter(w=>!week.sections.some(s=>s.id===w.id));
/** The same week without a tag on this section. */
export const dropWatch=(week:Week,id:string):Week=>week.watching?.some(s=>s.id===id)?withWatching(week,week.watching.filter(s=>s.id!==id)):week;
/** Tags a section for its semester. Returns the same array when it is already watched or already in the Plan. */
export function watchSection(plans:Week[],school:string,term:string,entry:Entry):Week[]{
 const week=weekOf(plans,school,term),list=week.watching??[];
 if(list.some(s=>s.id===entry.id)||week.sections.some(s=>s.id===entry.id))return plans;
 if(list.length>=WATCH_LIMIT)throw Error(`You can watch up to ${WATCH_LIMIT} sections a semester. Untag one first.`);
 return put(plans,{...week,watching:[...list,entry]});
}
export function unwatchSection(plans:Week[],school:string,term:string,id:string):Week[]{
 const week=weekOf(plans,school,term),next=dropWatch(week,id);
 return next===week?plans:put(plans,next);
}
/** Moves a watched section into the Plan. Only the student does this; nothing is added for them. */
export function promoteWatched(plans:Week[],school:string,term:string,id:string):Week[]{
 const week=weekOf(plans,school,term),entry=week.watching?.find(s=>s.id===id);
 if(!entry)return plans;
 return put(plans,{...dropWatch(week,id),sections:week.sections.some(s=>s.id===id)?week.sections:[...week.sections,entry]});
}

/** How a watched section sits against the Plan. A schedule PCC hasn't announced is never reported as fitting. */
export type Fit={kind:'fits'}|{kind:'async'}|{kind:'unknown'}|{kind:'clash',with:string[]};
export function fitOf(entry:Entry,plan:Entry[]):Fit{
 const clash=[...new Set(plan.filter(s=>s.id!==entry.id&&conflicts(entry,s)).map(s=>s.code))];
 if(clash.length)return {kind:'clash',with:clash};
 if(!entry.meetings.length||entry.meetings.some(m=>timeless(m)&&m.format_code!=='OD'))return {kind:'unknown'};
 return entry.meetings.every(timeless)?{kind:'async'}:{kind:'fits'};
}
export const fitText=(fit:Fit)=>fit.kind==='clash'?'Clashes with '+fit.with.join(', '):fit.kind==='fits'?'Fits your Plan':fit.kind==='async'?'Online / async · no set time':'Schedule unannounced · can’t check for clashes';
/** "Mon Wed 9:45 AM–11:10 AM · Fri 9:00 AM–11:50 AM"; empty when no meeting has a set time. */
export const meetingLine=(s:Entry)=>s.meetings.filter(m=>!timeless(m)).map(m=>m.days.map(d=>dayNames[d-1]).join(' ')+' '+englishTime(m.start_time)+'–'+englishTime(m.end_time)).join(' · ');
const dayHours=(list:Entry[],day:number)=>list.reduce((n,s)=>n+s.meetings.filter(m=>m.days.includes(day)&&m.start_time&&m.end_time).reduce((n,m)=>n+(minutes(m.end_time)!-minutes(m.start_time)!)/60,0),0);

export function Watches({store,school,term,terms=[],onTerm}:{store:PlanStore,school:string,term:string,terms?:Term[],onTerm:(id:string)=>void}){
 const [day,setDay]=useViewState('watchDay:'+school+':'+term,1),[message,setMessage]=useState(''),[undo,setUndo]=useState<Week[]|null>(null);
 const week=weekOf(store.plans,school,term),watching=watchingOf(week),all=[...week.sections,...watching];
 const jp=['月','火','水','木','金','土','日'],en=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
 // Weekdays always show. A weekend day shows when something meets then, so a watched Saturday class is never hidden.
 const shown=(i:number)=>i<5||all.some(s=>s.meetings.some(m=>m.days.includes(i+1)))||i===5&&week.weekend;
 const active=shown(day-1)?day:1;
 const clashing=watching.filter(s=>fitOf(s,week.sections).kind==='clash').length;
 const disabled=store.busy||store.conflict||!store.value;
 const termName=terms.find(t=>t.id===term)?.name??term;
 // Saved without keeping a draft: if the server refuses, nothing half-saved is left behind and the week stays as it was.
 async function apply(next:Week[],text:string){const before=store.plans;if(next===before)return;setMessage('');if(await store.persist(next,false)){setUndo(before);setMessage(text)}else setUndo(null)}
 const reportLink=(s:Entry)=>s.instructors[0]?'#/report/'+encodeURIComponent(s.instructors[0].id)+'?'+new URLSearchParams({school,term,course:s.course_id,code:s.code,title:s.title,days:'',online:'0'}):null;
 return <section className="plan-screen watch-screen">
  <div className="wa-plan-heading"><h1>Watches</h1><label className="wa-plan-semester"><span>Semester</span><select aria-label="Watches semester" value={term} onChange={e=>onTerm(e.target.value)}>{[...new Set([...terms.map(t=>t.id),term,...store.plans.filter(x=>x.school_id===school).map(x=>x.term_id)])].filter(Boolean).map(t=><option key={t} value={t}>{terms.find(x=>x.id===t)?.name??t}</option>)}</select></label></div>
  <p className="watch-lede">Sections you’re watching, laid over your Plan so you can see the week before you commit. Watching never changes your Plan or your CRN list.</p>
  {!store.value&&store.busy&&<p role="status">Laying out your week…</p>}
  {store.error&&<div role="alert">{store.error}<button onClick={()=>void store.reload()}>Reload</button></div>}
  <p className="watch-summary"><b>{week.sections.length}</b> in Plan · <b>{watching.length}</b> watching{clashing>0&&<> · <strong>{clashing} {clashing===1?'clash':'clashes'} with your Plan</strong></>}</p>
  <div className="wa-study-key watch-key"><span><i/> In your Plan</span><span><i className="dotted"/> Watching</span></div>
  <div className="plan-days" role="tablist" aria-label="Day">{jp.map((j,i)=>{if(!shown(i))return null;const overlap=layoutMeetings(all,i+1).some(r=>r.lanes>1),planned=dayHours(week.sections,i+1),extra=dayHours(watching,i+1);return <button role="tab" aria-selected={active===i+1} aria-label={en[i]} key={j} onClick={()=>setDay(i+1)}><i className="wa-day-load" style={{height:Math.min(40,planned*6)+'px'}}/><span lang="ja">{j}</span>{overlap&&<strong className="wa-day-conflict" aria-label="Overlapping meetings">!</strong>}<small>{planned.toFixed(1)} h</small>{extra>0&&<small className="watch-extra">+{extra.toFixed(1)} h</small>}</button>})}</div>
  <div className="wa-plan-body"><div className="wa-plan-calendar">
   <div className="phone-timeline"><h2><span lang="ja">{jp[active-1]}曜日</span> · {en[active-1]}</h2><Timeline sections={week.sections} watching={watching} day={active}/></div>
   <div className="desktop-week">{jp.map((j,i)=>shown(i)?<div key={j} className={active===i+1?'selected-day':''}><h3><span lang="ja">{j}曜日</span> · {en[i]}</h3><Timeline sections={week.sections} watching={watching} day={i+1}/></div>:null)}</div>
  </div>
  <aside className="wa-plan-sidebar"><section className="watch-list" aria-labelledby="watch-list-title"><h2 id="watch-list-title">Watching · {watching.length}</h2>
   {!watching.length&&<p className="watch-empty">Nothing watched for {termName} yet. Open a professor’s report and press <b>Watch</b> on a section. <a href="#/search">Search classes →</a></p>}
   {watching.map(s=>{const fit=fitOf(s,week.sections),gone=store.missing.includes([school,term,s.id].join(':')),link=reportLink(s),times=meetingLine(s),name=s.code+' · CRN '+s.id;return <article className={'watch-row '+fit.kind} key={s.id}>
    <h3>{s.code}{s.title&&<span> {s.title}</span>}</h3>
    <p>{s.instructors.map(p=>p.name).join(', ')||'Instructor TBA'} · CRN {s.id}</p>
    {times&&<p>{times}</p>}
    <p className="watch-fit">{fitText(fit)}{gone&&' · No longer listed by PCC · saved snapshot'}</p>
    <div className="watch-actions"><button className="primary" disabled={disabled} aria-label={'Add '+name+' to Plan'} onClick={()=>void apply(promoteWatched(store.plans,school,term,s.id),'Added '+name+' to your Plan'+(fit.kind==='clash'?' · overlaps '+fit.with.join(', '):''))}>Add to Plan</button><button disabled={disabled} aria-label={'Untag '+name} onClick={()=>void apply(unwatchSection(store.plans,school,term,s.id),'Untagged '+name)}>Untag</button>{link&&<a className="link" href={link} aria-label={'Open report for '+name}>Open report →</a>}</div>
   </article>})}
   {message&&<p className="watch-message" role="status">{message}{undo&&<button disabled={disabled} onClick={async()=>{if(await store.persist(undo,false)){setUndo(null);setMessage('Undone')}}}>Undo</button>}</p>}
  </section></aside></div>
  <p className="wa-registration-note">Watching is only a preview. Nothing here is in your Plan, and nothing is enrolled until you register with PCC.</p>
 </section>;
}
