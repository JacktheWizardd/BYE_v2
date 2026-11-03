import {parseCatalog,parseCalendar,parseGe,entries,alias} from './education-checks.js';
const origin='https://curriculum.pasadena.edu';
export async function reference(repository,key,fetcher=fetch){
 if(!/^(calendar|ge|catalog:[a-z]{2,12})$/.test(key))return null;
 const url=origin+(key==='calendar'?'/official-calendar/':key==='ge'?'/degree-certificate-requirements/':`/course-descriptions/${key.split(':')[1]}/`);
 const rows=await repository.request('bye_reference_cache',{key:`eq.${key}`,select:'*',limit:1}),previous=rows[0];
 if(previous?.data&&Date.now()-Date.parse(previous.checked_at)<90*86400000)return {...previous.data,checked_at:previous.checked_at};
 const claimed=await repository.request('rpc/bye_reference_claim',{}, {method:'POST',body:{p_key:key}});if(!claimed)return previous?.data?{...previous.data,checked_at:previous.checked_at,stale:true}:null;
 try{
  const gate=await repository.request('rpc/bye_reference_claim',{}, {method:'POST',body:{p_key:'__gate__'}});if(!gate){await repository.request('bye_reference_cache',{key:`eq.${key}`},{method:'PATCH',body:{lease_until:new Date(Date.now()+1000).toISOString()}});return previous?.data?{...previous.data,stale:true}:null}
  const response=await fetcher(url,{headers:{'User-Agent':'BYE education-plan public-reference reader (cached; student planning)'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok||!response.body)throw Error('unavailable');
  const reader=response.body.getReader(),chunks=[];let length=0;while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>2*1024*1024){await reader.cancel();throw Error('too_large')}chunks.push(value)}const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}const html=new TextDecoder().decode(bytes),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const data=hash===previous?.hash?previous.data:key==='calendar'?{calendar:parseCalendar(html,url),source:url}:key==='ge'?parseGe(html,url):parseCatalog(html,url,hash);
  if(key.startsWith('catalog:')&&!Object.keys(data.courses).length||key==='ge'&&!Object.keys(data.areas).length||key==='calendar'&&!Object.keys(data.calendar).length)throw Error('unrecognized_source');
  const checked_at=new Date().toISOString();await repository.request('bye_reference_cache',{key:`eq.${key}`},{method:'PATCH',body:{data,hash,checked_at,lease_until:null}});return {...data,checked_at};
 }catch{await repository.request('bye_reference_cache',{key:`eq.${key}`},{method:'PATCH',body:{lease_until:new Date(Date.now()+300000).toISOString()}});return previous?.data?{...previous.data,checked_at:previous.checked_at,stale:true}:null}
}
export async function planReferences(repository,plan,fetcher=fetch){
 if(plan?.match_school_id!=='pasadena-city-college')return {supported:false,courses:{},calendar:{},ge:null,pending:[]};
 const calendar=await reference(repository,'calendar',fetcher);await new Promise(r=>setTimeout(r,1000));const ge=await reference(repository,'ge',fetcher);
 const queue=entries(plan).flatMap(e=>[e.code,...(e.options??[]).map(o=>o.code)]).filter(c=>/^[A-Z]{2,8}\s+[A-Z]?\d/.test(c)),visited=new Set(),processed=new Set(),courses={},checked=[];let stale=false,fetched=0;const pending=[];
 const references=node=>node?.op==='course'?[node.code]:(node?.args??[]).flatMap(references);
 while(queue.length&&processed.size<1000){const code=queue.shift(),key=alias(code);if(processed.has(key))continue;processed.add(key);const subject=code.match(/^([A-Z]{2,8})\s/)?.[1]?.toLowerCase();if(!subject)continue;
  if(!visited.has(subject)){
   if(visited.size>=40){pending.push(subject);continue}visited.add(subject);
   const old=(await repository.request('bye_reference_cache',{key:`eq.catalog:${subject}`,select:'data,checked_at',limit:1}))[0];let data=old?.data;
   if(!data||Date.now()-Date.parse(old.checked_at)>90*86400000){if(fetched>=2){pending.push(subject);continue}await new Promise(r=>setTimeout(r,1000));data=await reference(repository,'catalog:'+subject,fetcher);fetched++}
   if(!data){pending.push(subject);continue}if(data.stale)stale=true;const at=data.checked_at??old?.checked_at;if(at)checked.push(at);for(const [k,course] of Object.entries(data.courses))courses[k]={...course,checked_at:at??null};
  }
  const course=courses[key];if(course)for(const rule of course.rules)for(const ref of references(rule.tree))if(!processed.has(alias(ref)))queue.push(ref);
 }

 return {supported:true,courses,calendar:calendar?.calendar??{},calendar_source:calendar?.source,ge,checked_at:[...checked,calendar?.checked_at,ge?.checked_at].filter(Boolean).sort()[0]??null,pending:[...new Set([...pending,...queue.map(c=>c.match(/^([A-Z]+)/)?.[1]?.toLowerCase()).filter(Boolean)])],stale:stale||!!calendar?.stale||!!ge?.stale};
}
