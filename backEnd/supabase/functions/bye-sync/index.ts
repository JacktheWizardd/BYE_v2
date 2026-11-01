import { digest } from '../../../src/production.js';
import { runSync } from '../../../src/sync.js';
import { runtime } from '../_shared/runtime.ts';
let ready:ReturnType<typeof runtime>|undefined;
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return new Response(null,{status:405});
 try {
 if(!ready)ready=runtime().catch(error=>{ready=undefined;throw error;});
 const config=await ready;
 if(await digest(request.headers.get('authorization')??'',config.cronSecret)!==await digest(`Bearer ${config.cronSecret}`,config.cronSecret))return new Response(null,{status:401});
 const result=await runSync(config.repository);console.log(JSON.stringify({status:result.status,job_id:result.job_id}));return Response.json(result);
 }catch{console.error('sync_failed');return Response.json({error:'sync_failed'},{status:503});}
});
