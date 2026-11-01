import fs from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);
async function files(dir){const result=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){const path=new URL(item.name+(item.isDirectory()?'/':''),dir);if(item.isDirectory())result.push(...await files(path));else result.push(path)}return result}
const assets=await files(root);const scripts=assets.filter(p=>p.pathname.endsWith('.js'));if(!scripts.length)throw Error('Build the production app first.');
for(const path of assets){if(/(?:\.env|session|\.map$)/i.test(path.pathname))throw Error('Private/debug asset in deployment.');}
const bundle=(await Promise.all(scripts.map(p=>fs.readFile(p,'utf8')))).join('\n');
for(const marker of ['bye_benchmark=cache-only','bye-benchmark-auth','bye-benchmark'])if(bundle.includes(marker))throw Error('Benchmark or private configuration must not be deployed.');
if(/\bsb_secret_[A-Za-z0-9_-]{16,}/.test(bundle))throw Error('Private Supabase key in deployment.');
if(!bundle.includes('https://yjcrupbibflagchcdeun.supabase.co/functions/v1/bye-api/v1'))throw Error('Production API is not configured.');
if(!assets.some(p=>p.pathname.endsWith('/_headers')))throw Error('Cloudflare headers missing.');
console.log('Production deployment checks passed: configured API, no benchmark/debug/private assets.');
