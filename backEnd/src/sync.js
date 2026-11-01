import { createConnectors } from './connectors.js';
// A database lease spans fetch, staging, and publication across all instances.
export async function runSync(repository,{connectors=createConnectors(),clock=()=>performance.now()}={}) {
  // Absorb small Cron dispatch jitter without fetching before the persisted deadline.
  if(repository.request){const rows=await repository.request('bye_worker',{select:'next_fetch_at',id:'eq.true'});const delay=Date.parse(rows[0]?.next_fetch_at)-Date.now();if(delay>0&&delay<=2000)await new Promise(resolve=>setTimeout(resolve,Math.ceil(delay)+30));}
  if(repository.semesters)await repository.semesters('schedule');
  await repository.control('schedule');
  const job=await repository.control('claim');if(!job)return {status:'idle'};
  const started=clock();
  try {
    const school=await repository.school(job.school_id);
    if(!school||school.status==='disabled')throw new Error('school_disabled');
    const connector=connectors.get(school.connector);if(!connector)throw new Error('connector_required');
    const terms=await connector.terms();
    if(job.kind==='directory'){await repository.semesters('directory_finish',{id:job.id,token:job.lease_token,terms});return {job_id:job.id,status:'succeeded'};}
    const term=terms.find(t=>t.id===job.term_id);
    if(!term)throw new Error('term_not_published');
    const catalog=await connector.importTerm(term);
    await repository.control('stage',{id:job.id,token:job.lease_token,catalog});
    const metrics={duration_ms:Math.round(clock()-started),courses:catalog.courses.length,sections:catalog.sections.length,...(job.kind==='preview'?{sample:catalog.sections.slice(0,3)}:{}),
      ...(typeof Deno!=='undefined'?{memory_bytes:Deno.memoryUsage().rss}:{})};
    await repository.control('finish',{id:job.id,token:job.lease_token,metrics});
    return {job_id:job.id,status:'succeeded',metrics};
  }catch(error){
    await repository.control('fail',{id:job.id,token:job.lease_token,error:error.code??'import_failed',retry_seconds:Math.min(86400,Math.max(0,error.retrySeconds??0))});
    return {job_id:job.id,status:'failed'};
  }
}
