import React,{useEffect,useMemo,useRef,useState} from 'react';
import {ApiError} from './api';
import {loadEducationPlan,saveEducationPlan} from './educationPlan/api';
import {parseImportedPlanJson} from './educationPlan/json';
import {processLocalEducationPlanPdf} from './educationPlan/process';
import {disposeOcr} from './educationPlan/ocr';
import {recalculateDraft,reviewProgress,PlanValidationError,validateEducationPlan} from './educationPlan/validate';
import type {EducationPlan,PlanEntry,PlanTerm,SavedEducationPlan} from './educationPlan/types';
import './educationPlan/education-plan.css';

const STATUSES:PlanEntry['status'][]=['unknown','planned','enrolled','completed','waived'];
const KINDS:PlanEntry['kind'][]=['course','requirement','alternative','conditional','bundle'];

function clonePlan(plan:EducationPlan):EducationPlan{return structuredClone(plan)}

function SourcePreview({plan,pageImages,entry}:{plan:EducationPlan,pageImages:string[],entry:PlanEntry|null}){
 if(!entry?.source)return <p className="help">Select an entry with a source box to highlight it on the page.</p>;
 const page=entry.source.page;
 const image=pageImages[page-1];
 const geom=plan.pages[page-1];
 if(!image||!geom)return <p className="help">Source page preview unavailable.</p>;
 const [x0,y0,x1,y1]=entry.source.box;
 const style={left:`${(x0/geom.width)*100}%`,top:`${(y0/geom.height)*100}%`,width:`${((x1-x0)/geom.width)*100}%`,height:`${((y1-y0)/geom.height)*100}%`};
 return <div className="edu-source"><p className="eyebrow">SOURCE · PAGE {page}</p><div className="edu-source-frame"><img src={image} alt={`Education plan page ${page}`}/><span className="edu-highlight" style={style} aria-hidden="true"/></div><p className="help">Highlight is approximate from extracted text bounds. Confirm against the original wording.</p></div>;
}

export function EducationPlanScreen(){
 const [saved,setSaved]=useState<SavedEducationPlan|null>(null);
 const [draft,setDraft]=useState<EducationPlan|null>(null);
 const [pageImages,setPageImages]=useState<string[]>([]);
 const [warnings,setWarnings]=useState<string[]>([]);
 const [status,setStatus]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [selected,setSelected]=useState<{termId:string,entryId:string}|null>(null);
 const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading');
 const fileRef=useRef<HTMLInputElement>(null);
 const jsonRef=useRef<HTMLInputElement>(null);

 useEffect(()=>{
  const c=new AbortController();
  loadEducationPlan(c.signal).then(data=>{if(!c.signal.aborted){setSaved(data);if(data)setDraft(clonePlan(data.plan));setLoadState('ready')}}).catch(e=>{if(!c.signal.aborted){setError(e.message);setLoadState('error')}});
  return()=>{c.abort();void disposeOcr()};
 },[]);

 const progress=useMemo(()=>draft?reviewProgress(draft):null,[draft]);
 const selectedEntry=useMemo(()=>{
  if(!draft||!selected)return null;
  const term=draft.terms.find(t=>t.id===selected.termId);
  return term?.entries.find(e=>e.id===selected.entryId)??null;
 },[draft,selected]);

 function updatePlan(mutate:(plan:EducationPlan)=>void){
  setDraft(current=>{
   if(!current)return current;
   const next=clonePlan(current);
   mutate(next);
   return recalculateDraft(next);
  });
 }

 async function onPdf(file:File|null){
  if(!file||busy)return;
  setBusy(true);setError('');setStatus('Processing local PDF…');setWarnings([]);
  try{
   const result=await processLocalEducationPlanPdf(file,message=>setStatus(message));
   setDraft(recalculateDraft(result.plan));
   setPageImages(result.document.pageImages);
   setWarnings(result.warnings);
   setSelected(null);
   setStatus('Draft ready for review. Nothing was uploaded or saved yet.');
  }catch(e){setError((e as Error).message);setStatus('')}
  finally{setBusy(false);if(fileRef.current)fileRef.current.value=''}
 }

 async function onJsonFile(file:File|null){
  if(!file||busy)return;
  setBusy(true);setError('');
  try{
   const text=await file.text();
   const plan=parseImportedPlanJson(text);
   if(!plan.pages?.length)throw Error('Imported plan is missing page geometry.');
   setDraft(recalculateDraft(plan));
   setPageImages([]);
   setWarnings(['JSON import loaded into review. Re-check every term before saving.']);
   setStatus('Imported JSON draft. Review required before save.');
   setSelected(null);
  }catch(e){setError((e as Error).message)}
  finally{setBusy(false);if(jsonRef.current)jsonRef.current.value=''}
 }

 function downloadJson(){
  if(!draft)return;
  try{
   const payload=JSON.stringify(draft,null,2);
   const blob=new Blob([payload],{type:'application/json'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   a.href=url;a.download=`bye-education-plan-${draft.fingerprint.slice(0,8)}.json`;a.click();
   URL.revokeObjectURL(url);
   setStatus('Downloaded structured plan JSON from this device.');
  }catch(e){setError((e as Error).message)}
 }

 async function persist(){
  if(!draft||busy)return;
  setBusy(true);setError('');
  try{
   const checked=validateEducationPlan(draft);
   const revision=saved?.revision??0;
   const next=await saveEducationPlan(revision,checked);
   setSaved(next);
   setDraft(clonePlan(next.plan));
   setStatus(`Saved revision ${next.revision}. Original PDF stays on this device only.`);
  }catch(e){
   if(e instanceof PlanValidationError)setError(e.message);
   else if(e instanceof ApiError&&e.status===409)setError('The saved plan changed elsewhere. Reload the saved plan, then re-apply your reviewed draft.');
   else setError((e as Error).message);
  }finally{setBusy(false)}
 }

 async function reloadSaved(){
  setBusy(true);setError('');
  try{
   const data=await loadEducationPlan();
   setSaved(data);
   setDraft(data?clonePlan(data.plan):null);
   setPageImages([]);
   setWarnings([]);
   setSelected(null);
   setStatus(data?`Reloaded saved revision ${data.revision}.`:'No saved plan on the server.');
   setLoadState('ready');
  }catch(e){setError((e as Error).message);setLoadState('error')}
  finally{setBusy(false)}
 }

 function markTermReviewed(term:PlanTerm,reviewed:boolean){
  updatePlan(plan=>{
   const t=plan.terms.find(x=>x.id===term.id);if(!t)return;
   t.reviewed=reviewed;
   if(reviewed)t.entries.forEach(e=>{e.reviewed=true});
  });
 }

 function updateEntry(termId:string,entryId:string,patch:Partial<PlanEntry>){
  updatePlan(plan=>{
   const term=plan.terms.find(t=>t.id===termId);if(!term)return;
   const entry=term.entries.find(e=>e.id===entryId);if(!entry)return;
   Object.assign(entry,patch);
  });
 }

 function addManualEntry(termId:string){
  updatePlan(plan=>{
   const term=plan.terms.find(t=>t.id===termId);if(!term)return;
   const id=`${termId}-manual-${term.entries.length+1}`;
   term.entries.push({id,kind:'course',code:'',title:'',units:null,status:'unknown',source:null,correction:'Entered manually during review',exception:'',reviewed:false});
   term.reviewed=false;
   setSelected({termId,entryId:id});
  });
 }

 return <section className="edu-shell">
  <p className="eyebrow">EDUCATION PLAN · LOCAL PDF</p>
  <h1>Review an education plan.</h1>
  <p className="lede edu-lede">PDFs stay on this device. BYE only saves the structured plan you review. The weekly planner at <code>#/plan</code> is separate.</p>

  <div className="edu-toolbar">
   <label className="button primary">{busy?'Working…':'Choose local PDF'}<input ref={fileRef} className="sr" type="file" accept="application/pdf,.pdf" disabled={busy} onChange={e=>void onPdf(e.target.files?.[0]??null)}/></label>
   <label className="button">Import JSON<input ref={jsonRef} className="sr" type="file" accept="application/json,.json" disabled={busy} onChange={e=>void onJsonFile(e.target.files?.[0]??null)}/></label>
   <button className="button" type="button" disabled={!draft||busy} onClick={downloadJson}>Export JSON</button>
   <button className="button" type="button" disabled={busy} onClick={()=>void reloadSaved()}>Reload saved</button>
   <button className="button primary" type="button" disabled={!draft||busy||!progress?.complete} onClick={()=>void persist()}>{busy?'Saving…':'Save reviewed plan'}</button>
  </div>

  <p className="help">Limits: local PDF up to 20 MiB / 30 pages. Saved JSON up to 1 MiB. Alternatives and mismatched totals need an explicit note. A cancelled or failed save leaves the previous plan intact.</p>
  {loadState==='loading'&&<p role="status">Loading any saved plan…</p>}
  {status&&<p role="status" className="status ok">{status}</p>}
  {error&&<p role="alert" className="status">{error}</p>}
  {!!warnings.length&&<div className="notice" role="status"><p>Extraction notes</p><ul>{warnings.map(w=><li key={w}>{w}</li>)}</ul></div>}
  {saved&&<p className="help">Server revision {saved.revision} · updated {new Date(saved.updated_at).toLocaleString()}. Saving sends reviewed structured data only — never the PDF.</p>}
  {progress&&<p className="help">Review progress: {progress.reviewedEntries}/{progress.entries} entries · {progress.reviewedTerms}/{progress.terms} terms{progress.complete?' · ready to save':''}.</p>}

  {!draft&&loadState==='ready'&&!busy&&<div className="empty"><h2>No draft yet.</h2><p>Choose a local PDF education plan, import JSON, or reload a previously saved plan.</p></div>}

  {draft&&<div className="edu-layout">
   <div className="edu-main">
    <div className="panel">
     <label htmlFor="edu-institution">Institution</label>
     <input id="edu-institution" value={draft.institution} onChange={e=>updatePlan(p=>{p.institution=e.target.value})}/>
     <label htmlFor="edu-purpose">Purpose</label>
     <input id="edu-purpose" value={draft.purpose} onChange={e=>updatePlan(p=>{p.purpose=e.target.value})}/>
     <div className="two">
      <label>Printed total units<input type="number" step="0.01" min="0" value={draft.printed_units??''} onChange={e=>updatePlan(p=>{p.printed_units=e.target.value===''?null:Number(e.target.value)})}/></label>
      <label>Calculated total<input value={draft.calculated_units??'—'} readOnly/></label>
     </div>
     <label htmlFor="edu-exception">Plan exception / totals note</label>
     <input id="edu-exception" value={draft.exception} placeholder="Required when printed and calculated totals disagree" onChange={e=>updatePlan(p=>{p.exception=e.target.value})}/>
     <p className="help">Fingerprint {draft.fingerprint.slice(0,16)}… · {draft.pages.length} page{draft.pages.length===1?'':'s'}</p>
    </div>

    {draft.terms.map(term=><article className="edu-term panel" key={term.id}>
     <div className="edu-term-head">
      <div>
       <h2>{term.label}</h2>
       <p className="help">{term.basis} · year {term.year??'unknown'} · printed {term.printed_units??'—'} · calculated {term.calculated_units??'—'}</p>
      </div>
      <label className="check"><input type="checkbox" checked={term.reviewed} onChange={e=>markTermReviewed(term,e.target.checked)}/> Term reviewed</label>
     </div>
     <label>Term exception<input value={term.exception} placeholder="Required when this term’s totals disagree" onChange={e=>updatePlan(p=>{const t=p.terms.find(x=>x.id===term.id);if(t)t.exception=e.target.value})}/></label>
     <div className="table-box">
      <table className="data">
       <thead><tr><th>Code</th><th>Title</th><th>Units</th><th>Kind</th><th>Status</th><th>Reviewed</th><th/></tr></thead>
       <tbody>
        {term.entries.map(entry=><tr key={entry.id} className={selected?.entryId===entry.id?'fresh':undefined}>
         <td><input value={entry.code} aria-label={`Code for ${entry.id}`} onFocus={()=>setSelected({termId:term.id,entryId:entry.id})} onChange={e=>updateEntry(term.id,entry.id,{code:e.target.value})}/></td>
         <td><input value={entry.title} aria-label={`Title for ${entry.id}`} onFocus={()=>setSelected({termId:term.id,entryId:entry.id})} onChange={e=>updateEntry(term.id,entry.id,{title:e.target.value})}/></td>
         <td><input type="number" step="0.01" min="0" value={entry.units??''} aria-label={`Units for ${entry.id}`} onFocus={()=>setSelected({termId:term.id,entryId:entry.id})} onChange={e=>updateEntry(term.id,entry.id,{units:e.target.value===''?null:Number(e.target.value)})}/></td>
         <td><select value={entry.kind} aria-label={`Kind for ${entry.id}`} onFocus={()=>setSelected({termId:term.id,entryId:entry.id})} onChange={e=>updateEntry(term.id,entry.id,{kind:e.target.value as PlanEntry['kind']})}>{KINDS.map(k=><option key={k} value={k}>{k}</option>)}</select></td>
         <td><select value={entry.status} aria-label={`Status for ${entry.id}`} onFocus={()=>setSelected({termId:term.id,entryId:entry.id})} onChange={e=>updateEntry(term.id,entry.id,{status:e.target.value as PlanEntry['status']})}>{STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></td>
         <td><input type="checkbox" checked={entry.reviewed} aria-label={`Reviewed ${entry.id}`} onChange={e=>updateEntry(term.id,entry.id,{reviewed:e.target.checked})}/></td>
         <td><button type="button" className="link" onClick={()=>setSelected({termId:term.id,entryId:entry.id})}>Source</button></td>
        </tr>)}
       </tbody>
      </table>
     </div>
     {term.entries.map(entry=>selected?.entryId===entry.id&&<div className="edu-entry-meta" key={`meta-${entry.id}`}>
      <label>Correction note<input value={entry.correction} placeholder={entry.source? 'Optional note about edits':'Required for manual entries'} onChange={e=>updateEntry(term.id,entry.id,{correction:e.target.value})}/></label>
      <label>Exception / unresolved choice<input value={entry.exception} placeholder="Required for alternatives and conditionals" onChange={e=>updateEntry(term.id,entry.id,{exception:e.target.value})}/></label>
      <p className="help">{entry.source?`Source page ${entry.source.page} box [${entry.source.box.map(n=>Math.round(n)).join(', ')}]`:'No source box — correction note required before save.'}</p>
     </div>)}
     <button type="button" className="button" onClick={()=>addManualEntry(term.id)}>Add manual entry</button>
    </article>)}
   </div>
   <aside className="edu-aside">
    <SourcePreview plan={draft} pageImages={pageImages} entry={selectedEntry}/>
    <div className="panel">
     <h2>Before you save</h2>
     <ul className="edu-checklist">
      <li>Visually compare every course and units against the PDF.</li>
      <li>Keep unknown status when the document does not prove completion.</li>
      <li>Do not count every alternative as required.</li>
      <li>Document mismatched totals instead of silently “fixing” them.</li>
     </ul>
    </div>
   </aside>
  </div>}
 </section>;
}
