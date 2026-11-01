import {frontendOrigins} from './frontend-origins.ts';
import { ProductionRepository } from '../../../src/production.js';
export async function runtime(){
 const url=Deno.env.get('SUPABASE_URL');
 const secret=Deno.env.get('BYE_DATABASE_SECRET')||JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const publishableKey=Deno.env.get('BYE_PUBLISHABLE_KEY')||JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY');
 if(!url||!secret||!publishableKey)throw new Error('Missing injected project configuration');
 const repository=new ProductionRepository(url,secret);
 const values=await repository.request('rpc/bye_runtime_secrets',{}, {method:'POST',body:{}});
 return {url,secret,publishableKey,repository,pepper:values.pepper,cronSecret:values.cron_secret,allowedOrigin:[...new Set([...frontendOrigins,...(Deno.env.get('BYE_ALLOWED_ORIGINS')||Deno.env.get('BYE_ALLOWED_ORIGIN')||'').split(',').map(value=>value.trim()).filter(Boolean)])]};
}
