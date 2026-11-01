import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.js';
import { LocalRepository, SupabaseRepository } from './repository.js';

const ownerToken = process.env.BYE_OWNER_TOKEN, readToken = process.env.BYE_READ_TOKEN;
if (!ownerToken || ownerToken.length < 32 || (readToken && (readToken.length < 32 || readToken === ownerToken))) {
  throw new Error('Set BYE_OWNER_TOKEN (32+ characters) and an optional different BYE_READ_TOKEN (32+ characters).');
}
const supabaseUrl = process.env.SUPABASE_URL, secretKey = process.env.SUPABASE_SECRET_KEY;
if (Boolean(supabaseUrl) !== Boolean(secretKey)) throw new Error('Set both SUPABASE_URL and SUPABASE_SECRET_KEY.');
if (supabaseUrl && new URL(supabaseUrl).protocol !== 'https:') throw new Error('SUPABASE_URL must use HTTPS.');
const dataFile = fileURLToPath(new URL('../.data/catalog.json', import.meta.url));
let repository;
if (supabaseUrl) {
  repository = new SupabaseRepository(supabaseUrl, secretKey);
} else {
  let state;
  try { state = JSON.parse(await readFile(dataFile, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  repository = new LocalRepository(state, async value => {
    await mkdir(dirname(dataFile), { recursive: true, mode: 0o700 });
    const temporary = `${dataFile}.${crypto.randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
      await rename(temporary, dataFile);
    } finally { await rm(temporary, { force: true }); }
  });
}
function matches(value, expected) {
  if (!expected) return false;
  const a = Buffer.from(value), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
const handle = createApi({ repository, allowedOrigin: process.env.BYE_ALLOWED_ORIGIN || null,
  authorize: async request => {
    const header = request.headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) return null;
    const token = header.slice(7);
    if (matches(token, ownerToken)) return { role: 'owner' };
    return matches(token, readToken) ? { role: 'reader' } : null;
  },
});
const port = Number(process.env.PORT || 8787);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT.');

// Local runner only. Use a hosting adapter and session verification before public
// deployment. The core handler has no Node dependency and fails closed by default.
const server = createServer(async (incoming, outgoing) => {
  try {
    const request = new Request(`http://localhost:${port}${incoming.url}`, {
      method: incoming.method, headers: incoming.headers,
      ...(!['GET', 'HEAD'].includes(incoming.method) ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}),
    });
    const response = await handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    outgoing.end(JSON.stringify({ error: { code: 'internal_error', message: 'The request could not be completed.' } }));
  }
});
server.listen(port, '127.0.0.1', () => console.log(`BYE API: http://127.0.0.1:${port}/v1/schools (${supabaseUrl ? 'Supabase' : 'local file storage'})`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close());
