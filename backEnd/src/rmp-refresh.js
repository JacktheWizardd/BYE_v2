import {createRmp} from './rmp.js';

// No incoming Request, student identity, or enrollment context crosses this boundary.
export async function runRmpRefresh(repository,{fetcher=fetch}={}) {
 const rpc=(action,p={})=>repository.request('rpc/bye_rmp_background',{}, {method:'POST',body:{action,p}});
 const job=await rpc('claim');
 if(!job?.token)return {status:'idle'};
 const rmp=createRmp(repository,{fetcher});
 const signal=AbortSignal.timeout(110000);
 const request=(url='https://bye.internal/rmp')=>new Request(url,{signal});
 try {
  const candidates=await rmp(request(),job.school_id,job.instructor_id,'candidates',{cacheOnly:false,background:true});
  if(candidates.stale)throw Error('refresh_incomplete');
  // Cover ambiguous names too; never silently link an uncertain identity.
  for(const candidate of candidates.candidates.slice(0,5)) {
   const url=new URL('https://bye.internal/rmp');url.searchParams.set('profile_id',candidate.id);
   const profile=await rmp(request(url),job.school_id,job.instructor_id,'profile',{cacheOnly:false,background:true});
   if(profile.stale)throw Error('refresh_incomplete');
   url.searchParams.set('limit','20');
   const reviews=await rmp(request(url),job.school_id,job.instructor_id,'reviews',{cacheOnly:false,background:true});
   if(reviews.stale)throw Error('refresh_incomplete');
  }
  await rpc('finish',{token:job.token,school_id:job.school_id,instructor_id:job.instructor_id});
  return {status:'succeeded'};
 } catch {
  await rpc('fail',{token:job.token,school_id:job.school_id,instructor_id:job.instructor_id});
  return {status:'failed'};
 }
}
