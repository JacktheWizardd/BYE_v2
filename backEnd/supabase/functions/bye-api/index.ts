import { createProductionApi } from '../../../src/production.js';
import { benchmarkUserId } from './benchmark-config.ts';
import { runtime } from '../_shared/runtime.ts';
let ready:Promise<ReturnType<typeof createProductionApi>>|undefined;
Deno.serve(async(request:Request)=>{
 try {
 if(!ready)ready=runtime().then(config=>createProductionApi({...config,benchmarkUserId})).catch(error=>{ready=undefined;throw error;});
 const handler=await ready;
 const url=new URL(request.url);url.pathname=url.pathname.replace(/^\/functions\/v1\/bye-api(?=\/|$)/,'').replace(/^\/bye-api(?=\/|$)/,'');
 return handler(new Request(url,request));
 }catch{return Response.json({error:{code:'configuration_unavailable',message:'The service is not ready.'}},{status:503});}
});
