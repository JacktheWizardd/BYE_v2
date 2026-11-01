// Trusted server-only setup/rotation. No owner credential is printed or bundled.
import {readFile,writeFile} from 'node:fs/promises';
const code=process.env.BYE_OWNER_CODE;delete process.env.BYE_OWNER_CODE;
if(!code||!/^\d{4}-?\d{4}$/.test(code))throw Error('Set BYE_OWNER_CODE to eight digits, optionally separated by a hyphen.');
const project=JSON.parse(await readFile(new URL('../supabase/deployment.json',import.meta.url))),url=new URL(project.api_base).origin;
const key=process.env.BYE_PUBLISHABLE_KEY||'sb_publishable_m4zaqKHhU-tXIF_pr66qWA_Tzhxee-1';
const file=new URL('../.owner-session.json',import.meta.url);let session=JSON.parse(await readFile(file));
if(session.expires_at*1000<Date.now()+60000){const r=await fetch(url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})});if(!r.ok)throw Error('Trusted owner session could not refresh.');session=await r.json();await writeFile(file,JSON.stringify(session),{mode:0o600})}
const r=await fetch(project.api_base+'/admin/owner-code',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({code})});
if(!r.ok)throw Error('Owner configuration failed: HTTP '+r.status);console.log('Owner sign-in code configured. No credential was printed.');
