// Server-only, repeatable import of the pinned historical reference. No source requests.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SupabaseRepository} from '../src/repository.js';
const directory=new URL('../reference/v1/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
const bytes=await readFile(new URL(manifest.catalog.file,directory)),hash=createHash('sha256').update(bytes).digest('hex');
if(hash!==manifest.catalog.file_sha256)throw Error('Reference checksum mismatch');
const catalog=JSON.parse(bytes);
if(catalog.courses.length!==1101||new Set(catalog.courses.map(r=>r[0])).size!==1101||catalog.courses.some(r=>r.length!==2||r.some(v=>typeof v!=='string'||!v.trim())))throw Error('Invalid reference catalog');
const url=process.env.SUPABASE_URL,key=process.env.BYE_DATABASE_SECRET;
if(!url||!key)throw Error('Set SUPABASE_URL and server-only BYE_DATABASE_SECRET');
const repo=new SupabaseRepository(url,key);
await repo.request('bye_course_reference',{on_conflict:'id'},{method:'POST',prefer:'resolution=ignore-duplicates,return=representation',body:{
 id:manifest.catalog.database_id,school_id:manifest.school_id,term_id:manifest.catalog.term_id,retrieved_on:catalog.retrieved,
 source_url:'https://api.github.com/repos/JacktheWizardd/BYE_frontend/git/blobs/'+manifest.sources[0].blob_sha,
 source_blob_sha:manifest.sources[0].blob_sha,payload_sha256:hash,courses:catalog.courses
}});
const rows=await repo.request('bye_course_reference',{id:'eq.'+manifest.catalog.database_id,select:'payload_sha256,courses'});
if(rows.length!==1||rows[0].payload_sha256!==hash||rows[0].courses.length!==1101)throw Error('Stored reference verification failed');
console.log('Verified 1,101 historical reference courses; live schedules unchanged.');
