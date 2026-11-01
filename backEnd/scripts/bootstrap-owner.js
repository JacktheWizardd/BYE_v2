import { writeFile } from 'node:fs/promises';
import { ProductionRepository } from '../src/production.js';
const {SUPABASE_URL,BYE_DATABASE_SECRET,BYE_PUBLISHABLE_KEY}=process.env;
if(!SUPABASE_URL||!BYE_DATABASE_SECRET||!BYE_PUBLISHABLE_KEY)throw new Error('Set server project credentials first.');
const repository=new ProductionRepository(SUPABASE_URL,BYE_DATABASE_SECRET);
const existing=await repository.request('bye_memberships',{select:'user_id',role:'eq.owner',revoked_at:'is.null',limit:1});
if(existing.length)throw new Error('An owner already exists. Recover access through your trusted database administrator.');
const response=await fetch(new URL('/auth/v1/signup',SUPABASE_URL),{method:'POST',headers:{apikey:BYE_PUBLISHABLE_KEY,'content-type':'application/json'},body:'{}'});
if(!response.ok)throw new Error('Anonymous sign-in failed. Enable it in the development project.');
const session=await response.json();
// Reserve output path before granting ownership; credentials are never printed.
const output=process.argv[2]??'.owner-session.json';
await writeFile(output,JSON.stringify(session),{mode:0o600,flag:'wx'});
await repository.request('bye_memberships',{}, {method:'POST',body:{user_id:session.user.id,role:'owner',expires_at:new Date(Date.now()+30*86400000).toISOString()}});
console.log('Owner provisioned. Session saved to the requested private file; keep it out of source control.');
