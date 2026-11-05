import type {EducationPlan,PlanEntry,PlanTerm,SourceRef} from './types';
import {MAX_PLAN_JSON_BYTES} from './types';

export class PlanValidationError extends Error{constructor(message:string){super(message);this.name='PlanValidationError'}}

function bad(message:string):never{throw new PlanValidationError(message)}
function isObject(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v)}
function keys(v:unknown,allowed:string[]):Record<string,unknown>{
 if(!isObject(v)||Object.keys(v).some(k=>!allowed.includes(k)))bad('Unexpected plan fields.');
 return v;
}
function text(v:unknown,max=160):string{
 if(typeof v!=='string'||v.length>max||/[\u0000-\u001f]/.test(v))bad('Invalid plan text.');
 return v.trim();
}
function number(v:unknown,max=1000):number{
 if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)bad('Invalid numerical value.');
 return v;
}
function units(v:unknown):number|null{return v===null?null:number(v)}

/** Client-side mirror of backend validateEducationPlan; recalculates totals and requires review. */
export function validateEducationPlan(input:unknown):EducationPlan{
 const raw=keys(input,['version','fingerprint','pages','purpose','institution','printed_units','terms','exception','calculated_units']);
 if(raw.version!==1||typeof raw.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(raw.fingerprint))bad('Invalid document fingerprint or version.');
 if(!Array.isArray(raw.pages)||!raw.pages.length||raw.pages.length>30)bad('Invalid source pages.');
 const pages=raw.pages.map((p:unknown)=>{
  const page=keys(p,['width','height']);
  return {width:number(page.width,20000),height:number(page.height,20000)};
 });
 if(pages.some(p=>!p.width||!p.height))bad('Invalid page geometry.');
 if(!Array.isArray(raw.terms)||!raw.terms.length||raw.terms.length>100)bad('Provide 1–100 terms.');
 const ids=new Set<string>();let totalEntries=0;
 const terms:PlanTerm[]=raw.terms.map((termRaw:unknown)=>{
  const t=keys(termRaw,['id','label','year','basis','printed_units','reviewed','exception','entries','calculated_units','course_entries','requirement_entries']);
  const id=text(t.id,80);if(!id||ids.has(id))bad('Term IDs must be unique.');ids.add(id);
  if(t.reviewed!==true)bad('Review every term before saving.');
  if(typeof t.basis!=='string'||!['semester','quarter','unknown'].includes(t.basis))bad('Invalid unit basis.');
  const year=t.year;
  if(year!==null&&(typeof year!=='number'||!Number.isInteger(year)||year<1900||year>2200))bad('Invalid year.');
  if(!Array.isArray(t.entries)||t.entries.length>200||(totalEntries+=t.entries.length)>1000)bad('Too many entries.');
  const entryIds=new Set<string>();
  const entries:PlanEntry[]=t.entries.map((entryRaw:unknown)=>{
   const e=keys(entryRaw,['id','kind','code','title','units','status','source','correction','exception','reviewed']);
   const eid=text(e.id,80);if(!eid||entryIds.has(eid))bad('Entry IDs must be unique within a term.');entryIds.add(eid);
   if(e.reviewed!==true)bad('Review every entry before saving.');
   if(typeof e.kind!=='string'||!['course','requirement','alternative','conditional','bundle'].includes(e.kind)||typeof e.status!=='string'||!['unknown','planned','enrolled','completed','waived'].includes(e.status))bad('Invalid entry type or status.');
   let source:SourceRef|null=null;
   if(e.source!==null){
    const s=keys(e.source,['page','box']);
    if(typeof s.page!=='number'||!Number.isInteger(s.page)||s.page<1||s.page>pages.length||!Array.isArray(s.box)||s.box.length!==4)bad('Invalid source reference.');
    const box=s.box.map((n:unknown)=>number(n,20000)) as [number,number,number,number];
    const p=pages[s.page-1];
    if(box[2]<=box[0]||box[3]<=box[1]||box[2]>p.width||box[3]>p.height)bad('Invalid source bounds.');
    source={page:s.page,box};
   }
   const correction=text(e.correction,1000),exception=text(e.exception,1000),code=text(e.code,120),title=text(e.title,300);
   if(!code&&!title)bad('Provide a course or requirement.');
   if(!source&&!correction)bad('Manual entries need a correction explanation.');
   if((e.kind==='alternative'||e.kind==='conditional')&&!exception)bad('Review unresolved course choices.');
   return {id:eid,kind:e.kind as PlanEntry['kind'],code,title,units:units(e.units),status:e.status as PlanEntry['status'],source,correction,exception,reviewed:true};
  });
  const printed=units(t.printed_units),exception=text(t.exception,1000);
  const known=entries.every(e=>e.units!==null&&!['alternative','conditional'].includes(e.kind));
  const calculated=known?Math.round(entries.reduce((n,e)=>n+(e.units??0),0)*100)/100:null;
  if(printed!==null&&calculated!==null&&Math.abs(printed-calculated)>.001&&!exception)bad('Explain mismatched semester totals.');
  const label=text(t.label);if(!label)bad('Provide a term label.');
  return {id,label,year:year as number|null,basis:t.basis as PlanTerm['basis'],printed_units:printed,reviewed:true,exception,entries,calculated_units:calculated,course_entries:entries.filter(e=>e.kind==='course').length,requirement_entries:entries.filter(e=>e.kind!=='course').length};
 });
 const exception=text(raw.exception,1000),printed=units(raw.printed_units);
 const sameBasis=new Set(terms.map(t=>t.basis)).size===1;
 const calculated=sameBasis&&terms.every(t=>t.calculated_units!==null)?Math.round(terms.reduce((n,t)=>n+(t.calculated_units??0),0)*100)/100:null;
 if(printed!==null&&calculated!==null&&Math.abs(printed-calculated)>.001&&!exception)bad('Explain mismatched overall totals.');
 const plan:EducationPlan={version:1,fingerprint:raw.fingerprint,pages,purpose:text(raw.purpose),institution:text(raw.institution),printed_units:printed,terms,exception,calculated_units:calculated};
 if(new TextEncoder().encode(JSON.stringify(plan)).length>MAX_PLAN_JSON_BYTES)bad('Plan exceeds the 1 MiB save limit.');
 return plan;
}

export function recalculateDraft(plan:EducationPlan):EducationPlan{
 const terms=plan.terms.map(t=>{
  const known=t.entries.every(e=>e.units!==null&&!['alternative','conditional'].includes(e.kind));
  const calculated=known?Math.round(t.entries.reduce((n,e)=>n+(e.units??0),0)*100)/100:null;
  return {...t,calculated_units:calculated,course_entries:t.entries.filter(e=>e.kind==='course').length,requirement_entries:t.entries.filter(e=>e.kind!=='course').length};
 });
 const sameBasis=new Set(terms.map(t=>t.basis)).size===1;
 const calculated=sameBasis&&terms.every(t=>t.calculated_units!==null)?Math.round(terms.reduce((n,t)=>n+(t.calculated_units??0),0)*100)/100:null;
 return {...plan,terms,calculated_units:calculated};
}

export function reviewProgress(plan:EducationPlan){
 const terms=plan.terms.length;
 const entries=plan.terms.reduce((n,t)=>n+t.entries.length,0);
 const reviewedTerms=plan.terms.filter(t=>t.reviewed).length;
 const reviewedEntries=plan.terms.reduce((n,t)=>n+t.entries.filter(e=>e.reviewed).length,0);
 return {terms,entries,reviewedTerms,reviewedEntries,complete:terms>0&&reviewedTerms===terms&&reviewedEntries===entries};
}
