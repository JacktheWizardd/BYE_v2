import {ApiError} from './errors.js';
const bad=message=>{throw new ApiError(400,'invalid_education_plan',message)};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function keys(v,allowed){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))bad('Unexpected plan fields.');}
function text(v,max=160){if(typeof v!=='string'||v.length>max||/[\u0000-\u001f]/.test(v))bad('Invalid plan text.');return v.trim();}
function number(v,max=1000){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)bad('Invalid numerical value.');return v;}
const units=v=>v===null?null:number(v);
export function validateEducationPlan(input){
 keys(input,['version','fingerprint','pages','purpose','institution','printed_units','terms','exception','calculated_units']);
 if(input.version!==1||! /^[a-f0-9]{64}$/.test(input.fingerprint))bad('Invalid document fingerprint or version.');
 if(!Array.isArray(input.pages)||!input.pages.length||input.pages.length>30)bad('Invalid source pages.');
 const pages=input.pages.map(p=>{keys(p,['width','height']);return {width:number(p.width,20000),height:number(p.height,20000)}});
 if(pages.some(p=>!p.width||!p.height))bad('Invalid page geometry.');
 if(!Array.isArray(input.terms)||!input.terms.length||input.terms.length>100)bad('Provide 1–100 terms.');
 const ids=new Set();let totalEntries=0;
 const terms=input.terms.map(t=>{
  keys(t,['id','label','year','basis','printed_units','reviewed','exception','entries','calculated_units','course_entries','requirement_entries']);
  const id=text(t.id,80);if(!id||ids.has(id))bad('Term IDs must be unique.');ids.add(id);
  if(t.reviewed!==true)bad('Review every term before saving.');
  if(!['semester','quarter','unknown'].includes(t.basis))bad('Invalid unit basis.');
  if(t.year!==null&&(!Number.isInteger(t.year)||t.year<1900||t.year>2200))bad('Invalid year.');
  if(!Array.isArray(t.entries)||t.entries.length>200||(totalEntries+=t.entries.length)>1000)bad('Too many entries.');
  const entryIds=new Set();const entries=t.entries.map(e=>{
   keys(e,['id','kind','code','title','units','status','source','correction','exception','reviewed']);
   const id=text(e.id,80);if(!id||entryIds.has(id))bad('Entry IDs must be unique within a term.');entryIds.add(id);
   if(e.reviewed!==true)bad('Review every entry before saving.');
   if(!['course','requirement','alternative','conditional','bundle'].includes(e.kind)||!['unknown','planned','enrolled','completed','waived'].includes(e.status))bad('Invalid entry type or status.');
   const source=e.source===null?null:(()=>{keys(e.source,['page','box']);const s=e.source;if(!Number.isInteger(s.page)||s.page<1||s.page>pages.length||!Array.isArray(s.box)||s.box.length!==4)bad('Invalid source reference.');const box=s.box.map(n=>number(n,20000)),p=pages[s.page-1];if(box[2]<=box[0]||box[3]<=box[1]||box[2]>p.width||box[3]>p.height)bad('Invalid source bounds.');return {page:s.page,box}})();
   const correction=text(e.correction,1000),exception=text(e.exception,1000),code=text(e.code,120),title=text(e.title,300);
   if(!code&&!title)bad('Provide a course or requirement.');if(!source&&!correction)bad('Manual entries need a correction explanation.');
   if((e.kind==='alternative'||e.kind==='conditional')&&!exception)bad('Review unresolved course choices.');
   return {id,kind:e.kind,code,title,units:units(e.units),status:e.status,source,correction,exception,reviewed:true};
  });
  const printed=units(t.printed_units),exception=text(t.exception,1000);
  const known=entries.every(e=>e.units!==null&&!['alternative','conditional'].includes(e.kind));
  const calculated=known?Math.round(entries.reduce((n,e)=>n+e.units,0)*100)/100:null;
  if(printed!==null&&calculated!==null&&Math.abs(printed-calculated)>.001&&!exception)bad('Explain mismatched semester totals.');
  const label=text(t.label);if(!label)bad('Provide a term label.');
  return {id,label,year:t.year,basis:t.basis,printed_units:printed,reviewed:true,exception,entries,calculated_units:calculated,course_entries:entries.filter(e=>e.kind==='course').length,requirement_entries:entries.filter(e=>e.kind!=='course').length};
 });
 const exception=text(input.exception,1000),printed=units(input.printed_units);
 const sameBasis=new Set(terms.map(t=>t.basis)).size===1;
 const calculated=sameBasis&&terms.every(t=>t.calculated_units!==null)?Math.round(terms.reduce((n,t)=>n+t.calculated_units,0)*100)/100:null;
 if(printed!==null&&calculated!==null&&Math.abs(printed-calculated)>.001&&!exception)bad('Explain mismatched overall totals.');
 return {version:1,fingerprint:input.fingerprint,pages,purpose:text(input.purpose),institution:text(input.institution),printed_units:printed,terms,exception,calculated_units:calculated};
}
