import {ApiError} from './errors.js';
const bad=message=>{throw new ApiError(400,'invalid_education_plan',message)};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function keys(v,allowed){if(!object(v)||Object.keys(v).some(k=>!allowed.includes(k)))bad('Unexpected plan fields.');}
function text(v,max=160){if(typeof v!=='string'||v.length>max||/[\u0000-\u001f]/.test(v))bad('Invalid plan text.');return v.trim();}
function number(v,max=1000){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>max)bad('Invalid numerical value.');return v;}
const units=v=>v===null?null:number(v);
function validateV1(input,qualifyBundles=false){
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
  const known=entries.every(e=>e.units!==null&&!['alternative','conditional',...(qualifyBundles?['bundle']:[])].includes(e.kind));
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

// Version 2 adds field-level provenance without changing the storage RPC.
function validateLegacyEducationPlan(input,qualifyBundles=false){
 if(input?.version!==2)return validateV1(input,qualifyBundles);
 const base=structuredClone(input);base.version=1;const sourceReviewed=base.sourceReviewed;delete base.sourceReviewed;if(sourceReviewed!==undefined&&sourceReviewed!==true)bad('Inspect the complete source before saving.');
 if(!Array.isArray(base.terms)||base.terms.length<1||base.terms.length>100)bad('Provide 1–100 terms.');for(const t of base.terms)if(!object(t)||!Array.isArray(t.entries)||t.entries.length>200)bad('Invalid term entries.');
 const termMetadata=[];
 const extra=[];
 for(const term of base.terms??[]){const meta={};for(const k of ['original','sources','originalSources','correction']){if(k in term){meta[k]=term[k];delete term[k]}}termMetadata.push(meta);}
 for(const term of base.terms??[])for(const entry of term.entries??[]){
  const {sources,original,issues,originalTermId,originalTerm,originalSources,resolvedIssues=[],...rest}=entry;
  if(!Array.isArray(sources)||sources.length>20||!Array.isArray(issues)||issues.length>20)bad('Invalid provenance.');
  if(original!==null)keys(original,['kind','code','title','units','status']);
  if(original?.kind!==undefined&&!['course','requirement','alternative','conditional','bundle'].includes(original.kind))bad('Invalid original entry kind.');
  const originalValue=original===null?null:{...(original.kind!==undefined?{kind:original.kind}:{}),code:text(original.code,120),title:text(original.title,300),units:units(original.units),status:text(original.status,40)};
  if(originalSources!==undefined&&originalSources!==null&&(!Array.isArray(originalSources)||originalSources.length>20))bad('Invalid original source references.');
  const refs=sources.map(source=>{keys(source,['page','box']);return source});
  const problems=issues.map(issue=>text(issue,300));
  if(!Array.isArray(resolvedIssues)||resolvedIssues.length>20||resolvedIssues.some(x=>!problems.includes(x)))bad('Invalid issue resolutions.');
  if(problems.some(x=>!resolvedIssues.includes(x))&&!entry.exception)bad('Explain unresolved extraction issues.');
  if(originalValue&&(originalValue.kind!==undefined&&entry.kind!==originalValue.kind||entry.code!==originalValue.code||entry.title!==originalValue.title||entry.units!==originalValue.units||entry.status!==originalValue.status)&&!entry.correction)bad('Explain corrected values.');
  if(originalTerm!==undefined&&originalTerm!==null){keys(originalTerm,['label','year','basis','printed_units']);text(originalTerm.label);units(originalTerm.printed_units);if(!['semester','quarter','unknown'].includes(originalTerm.basis)||originalTerm.year!==null&&(!Number.isInteger(originalTerm.year)||originalTerm.year<1900||originalTerm.year>2200))bad('Invalid original term assignment.');}
  if(originalTermId!==undefined&&originalTermId!==null&&typeof originalTermId!=='string')bad('Invalid original assignment.');if(originalTermId&&originalTermId!==term.id&&!entry.correction)bad('Explain changed term assignments.');
  if(originalSources!==undefined&&originalSources!==null&&JSON.stringify(originalSources)!==JSON.stringify(refs)&&!entry.correction)bad('Explain source corrections.');
  extra.push({sources:refs,original:originalValue,issues:problems,resolvedIssues,originalTermId:originalTermId??null,originalTerm:originalTerm??null,originalSources:originalSources??null});
  Object.keys(entry).forEach(k=>delete entry[k]);Object.assign(entry,rest,{source:refs[0]??null});
 }
 const validated=validateV1(base,qualifyBundles);let i=0;
 for(const term of validated.terms)for(const entry of term.entries){
  const provenance=extra[i++];
  // Validate every reference using the same geometry checks as the primary one.
  for(const source of [...provenance.sources,...(provenance.originalSources??[])]){keys(source,['page','box']);if(!Number.isInteger(source.page)||source.page<1||source.page>validated.pages.length||!Array.isArray(source.box)||source.box.length!==4)bad('Invalid source reference.');const box=source.box.map(n=>number(n,20000)),page=validated.pages[source.page-1];if(box[2]<=box[0]||box[3]<=box[1]||box[2]>page.width||box[3]>page.height)bad('Invalid source bounds.');}
  Object.assign(entry,provenance);
 }
 for(let j=0;j<validated.terms.length;j++){const t=validated.terms[j],meta=termMetadata[j];if(meta.original!==undefined&&meta.original!==null){keys(meta.original,['label','year','basis','printed_units']);text(meta.original.label);units(meta.original.printed_units);if(!['semester','quarter','unknown'].includes(meta.original.basis)||meta.original.year!==null&&(!Number.isInteger(meta.original.year)||meta.original.year<1900||meta.original.year>2200))bad('Invalid original term.');if(['label','year','basis','printed_units'].some(k=>t[k]!==meta.original[k])&&!meta.correction)bad('Explain corrected term values.');}if(meta.correction!==undefined)meta.correction=text(meta.correction,1000);for(const k of ['sources','originalSources'])if(meta[k]!==undefined&&meta[k]!==null){if(!Array.isArray(meta[k])||meta[k].length>20)bad('Invalid term sources.');for(const r of meta[k]){keys(r,['page','box']);const p=validated.pages[r.page-1];if(!Number.isInteger(r.page)||!p||!Array.isArray(r.box)||r.box.length!==4||r.box.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0)||r.box[2]<=r.box[0]||r.box[3]<=r.box[1]||r.box[2]>p.width||r.box[3]>p.height)bad('Invalid term source.');}}if(meta.originalSources&&JSON.stringify(meta.sources)!==JSON.stringify(meta.originalSources)&&!meta.correction)bad('Explain corrected term sources.');Object.assign(t,meta);}
 if(validated.terms.some(t=>t.basis==='unknown'))validated.calculated_units=null;
 return {...validated,version:2,...(sourceReviewed!==undefined?{sourceReviewed}: {})};
}

// Version 3 keeps review bookkeeping separate from immutable extraction values.
export function validateEducationPlan(input){
 if(input?.version!==3)return validateLegacyEducationPlan(input);
 const copy=structuredClone(input),review=copy.review,match_school_id=copy.match_school_id??null,document_issues=copy.document_issues??[],resolved_document_issues=copy.resolved_document_issues??[];delete copy.document_issues;delete copy.resolved_document_issues;delete copy.match_school_id;delete copy.review;copy.version=2;
 if(match_school_id!==null&&(typeof match_school_id!=='string'||! /^[a-z0-9-]{1,80}$/.test(match_school_id)))bad('Invalid schedule school.');
 if(copy.sourceReviewed!==true)bad('Inspect the complete source before saving.');
 if(!Array.isArray(copy.pages)||!Array.isArray(copy.terms)||copy.terms.length>100||copy.terms.some(t=>!object(t)||!Array.isArray(t.entries)||t.entries.length>200))bad('Invalid plan collections.');
 keys(review,['pages_seen','source_exception']);
 if(!Array.isArray(review.pages_seen)||review.pages_seen.length>30||new Set(review.pages_seen).size!==review.pages_seen.length||review.pages_seen.some(n=>!Number.isInteger(n)||n<1||n>copy.pages?.length))bad('Invalid inspected pages.');
 const reasons=['','pdf_silent','ask_counselor','other','source_unavailable'];
 if(!reasons.includes(review.source_exception))bad('Invalid source exception.');
 if(review.pages_seen.length!==copy.pages?.length&&!review.source_exception)bad('Inspect every PDF page or record a source exception.');
 if(!Array.isArray(document_issues)||document_issues.length>20||!Array.isArray(resolved_document_issues)||resolved_document_issues.length>20)bad('Invalid source-note review.');const documentIssues=document_issues.map(i=>text(i,300));if(resolved_document_issues.some(i=>!documentIssues.includes(i)))bad('Invalid source-note resolution.');if(documentIssues.some(i=>!resolved_document_issues.includes(i))&&!copy.exception)bad('Review source notes or document an exception.');
 const metadata=[],allIds=new Set();
 for(const t of copy.terms??[])for(const e of t.entries??[]){
  if(!object(e)||allIds.has(e.id))bad('Entry IDs must be unique across the plan.');allIds.add(e.id);
  const {options=[],original_options=null,status_source='import',exception_reason='',...rest}=e;
  if(!Array.isArray(options)||options.length>20)bad('Invalid course options.');
  const parsed=options.map(o=>{keys(o,['code','title','units']);const code=text(o.code,120);if(!code)bad('Provide an option code.');return {code,title:text(o.title,300),units:units(o.units)}});
  let originalOptions=null;if(original_options!==null){if(!Array.isArray(original_options)||original_options.length>20)bad('Invalid original options.');originalOptions=original_options.map(o=>{keys(o,['code','title','units']);return {code:text(o.code,120),title:text(o.title,300),units:units(o.units)}});if(JSON.stringify(originalOptions)!==JSON.stringify(parsed)&&!e.correction)bad('Explain changed course options.');}
  if(parsed.length&&e.kind!=='alternative')bad('Options require a choose-one entry.');
  if(!['student','import'].includes(status_source)||!reasons.includes(exception_reason))bad('Invalid entry provenance.');
  metadata.push({options:parsed,original_options:originalOptions,status_source,exception_reason,exception:rest.exception});
  if(e.kind==='alternative'&&parsed.length>=2&&!rest.exception)rest.exception='Reviewed unselected course options retained.';Object.keys(e).forEach(k=>delete e[k]);Object.assign(e,rest);
 }
 const result=validateLegacyEducationPlan(copy,true);let i=0;
 for(const t of result.terms)for(const e of t.entries)Object.assign(e,metadata[i++]);
 return {...result,version:3,match_school_id,document_issues:documentIssues,resolved_document_issues,review:{pages_seen:[...review.pages_seen],source_exception:review.source_exception}};
}
