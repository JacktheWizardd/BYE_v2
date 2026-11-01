import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';
import { createConnectors, normalizePccSchedule, PCC_SCHOOL } from '../src/connectors.js';
import { LocalRepository, SupabaseRepository } from '../src/repository.js';

const instant = '2026-10-30T22:00:00.000Z';
const now = () => new Date(instant);
const term = { id: '202730', name: 'Spring 2027' };
const row = (overrides = {}) => ({
  termCode: term.id, crn: '30001', subjCode: 'MATH', courseNumbDisplay: '005A', courseTitle: 'CALCULUS I',
  pfaName: 'Example Instructor', creditHrLow: '5', tueDay: 'T', beginTime: '0930', endTime: '1045',
  ptrmStartDate: '2027-02-17 00:00:00', ptrmEndDate: '2027-06-13 00:00:00',
  seatsAvail: '3', enrl: '27', maxEnrl: '30', waitCount: '0', waitCapacity: '10', waitAvail: '10', fwSectOpenInd: 'O',
  ...overrides,
});
const catalog = (rows = [row()]) => ({ term: { ...term, as_of: instant }, ...normalizePccSchedule(rows, term.id, instant) });
const authorize = async request => {
  const token = request.headers.get('authorization');
  return token === 'Bearer owner' ? { role: 'owner' } : token === 'Bearer reader' ? { role: 'reader' } : null;
};
function setup(options = {}) {
  const repository = options.repository ?? new LocalRepository();
  const handle = createApi({ repository, authorize, now, ...options });
  async function call(path = '', { method = 'GET', role = 'reader', json, headers = {} } = {}) {
    const request = new Request(`https://bye.test/v1/schools${path}`, {
      method, headers: { ...(role ? { authorization: `Bearer ${role}` } : {}),
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    });
    const response = await handle(request);
    return { status: response.status, headers: response.headers,
      body: response.status === 204 ? null : await response.json() };
  }
  return { repository, handle, call };
}
const base = '/pasadena-city-college';
const imported = `${base}/terms/${term.id}`;

test('school search matches name, alias and domain; unmatched searches are empty', async () => {
  const { call } = setup();
  for (const q of ['PASADENA', 'pcc', 'findclasses.pasadena.edu']) {
    const response = await call(`?q=${encodeURIComponent(q)}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.data[0].id, PCC_SCHOOL.id);
    assert.equal(response.body.data[0].status, 'setup_required');
    assert.equal(response.body.next_cursor, null);
  }
  assert.deepEqual((await call('?q=unknown')).body.data, []);
});

test('requests require authorization, and the standalone handler fails closed', async () => {
  const { call } = setup();
  assert.equal((await call('', { role: null })).status, 401);
  assert.equal((await call('', { role: 'invalid' })).status, 401);
  const handle = createApi({ repository: new LocalRepository() });
  assert.equal((await handle(new Request('https://bye.test/v1/schools'))).status, 401);
});

test('school creation and source lookups require owner access', async () => {
  const { call } = setup();
  assert.equal((await call('', { method: 'POST', json: {} })).status, 403);
  assert.equal((await call(`${base}/source-terms`)).status, 403);
  assert.equal((await call(`${base}/imports`, { method: 'POST', json: { term_id: term.id } })).status, 403);
});

test('an unknown school is saved pending without fetching the URL or accepting capability claims', async () => {
  let fetched = 0;
  const connectors = createConnectors({ fetcher: async () => { fetched++; throw new Error(); } });
  const { call } = setup({ connectors });
  const input = { name: 'Other College', schedule_url: 'https://other.example.edu/schedule/', aliases: ['OC'],
    status: 'active', connector: 'pcc', capabilities: { seats: true } };
  const saved = await call('', { method: 'POST', role: 'owner', json: input });
  assert.equal(saved.status, 201);
  assert.equal(saved.body.data.status, 'pending');
  assert.equal(saved.body.data.connector, null);
  assert.deepEqual(saved.body.data.capabilities, { schedules: false, seats: false, waitlists: false });
  assert.equal((await call('?q=OC')).body.data[0].id, 'other-college');
  assert.equal((await call('/other-college/terms')).body.error.code, 'connector_required');
  assert.equal(fetched, 0);
});

test('duplicate IDs, normalized URLs and PCC URL query variants return conflict', async () => {
  const { call } = setup();
  const input = { name: 'Duplicate PCC', schedule_url: 'https://findclasses.pasadena.edu/?term=202730#search' };
  assert.equal((await call('', { method: 'POST', role: 'owner', json: input })).status, 409);
  const other = { id: 'pasadena-city-college', name: 'Other', schedule_url: 'https://other.example.edu/' };
  assert.equal((await call('', { method: 'POST', role: 'owner', json: other })).status, 409);
});

test('setup rejects non-public URLs, credentials, malformed names and invalid aliases', async () => {
  const { call } = setup();
  for (const schedule_url of ['http://example.edu', 'https://127.0.0.1', 'https://localhost', 'https://[::1]/',
    'https://school.internal', 'https://school.local', 'https://user:secret@example.edu/', 'https://example.edu:8443/', 'invalid']) {
    assert.equal((await call('', { method: 'POST', role: 'owner', json: { name: 'Test College', schedule_url } })).status, 400, schedule_url);
  }
  for (const input of [{ name: 'A' }, { name: 'Test', aliases: [''] }, { name: 'Test', id: '../school' }]) {
    assert.equal((await call('', { method: 'POST', role: 'owner', json: { schedule_url: 'https://example.edu/', ...input } })).status, 400);
  }
});

test('pagination is stable and validates bounds', async () => {
  const { call } = setup();
  await call('', { method: 'POST', role: 'owner', json: { name: 'Alpha College', schedule_url: 'https://alpha.example.edu/' } });
  const first = await call('?limit=1');
  assert.equal(first.body.data[0].id, 'alpha-college');
  assert.equal(first.body.next_cursor, '1');
  const next = await call(`?limit=1&cursor=${first.body.next_cursor}`);
  assert.equal(next.body.data[0].id, PCC_SCHOOL.id);
  assert.equal(next.body.next_cursor, null);
  for (const params of ['limit=0', 'limit=101', 'limit=abc', 'cursor=-1', 'cursor=2.5', 'cursor=9007199254740999']) {
    assert.equal((await call(`?${params}`)).status, 400);
  }
});

test('import merges meeting rows and preserves section counts without duplicates', async () => {
  const repository = new LocalRepository();
  const data = catalog([row(), row({ tueDay: null, thuDay: 'R', beginTime: '1100' }), row()]);
  await repository.importTerm(PCC_SCHOOL.id, data);
  await repository.importTerm(PCC_SCHOOL.id, data);
  const { call } = setup({ repository });
  assert.equal((await call(base)).body.data.status, 'active');
  assert.equal((await call(`${base}/terms`)).body.data.length, 1);
  assert.equal((await call(`${imported}/courses?q=calculus`)).body.data.length, 1);
  const sections = (await call(`${imported}/sections?course_id=MATH-005A`)).body.data;
  assert.equal(sections.length, 1);
  assert.equal(sections[0].meetings.length, 2);
  assert.deepEqual(sections[0].meetings[0].days, [2]);
  assert.equal(sections[0].meetings[0].start_time, '09:30');
  assert.equal(sections[0].instructors.length, 1);
  assert.equal((await call(`${imported}/sections?course_id=CS-002`)).body.data.length, 0);
});

test('same term, course and CRN at different schools never mix', async () => {
  const otherSchool = { ...PCC_SCHOOL, id: 'other-college', name: 'Other College', schedule_url: 'https://other.example.edu/' };
  const repository = new LocalRepository({ schools: [PCC_SCHOOL, otherSchool], catalogs: {} });
  await repository.importTerm(PCC_SCHOOL.id, catalog());
  await repository.importTerm(otherSchool.id, catalog([row({ courseTitle: 'DIFFERENT COURSE', seatsAvail: '9' })]));
  const { call } = setup({ repository });
  assert.equal((await call(`${imported}/courses`)).body.data[0].title, 'CALCULUS I');
  assert.equal((await call(`/other-college/terms/${term.id}/courses`)).body.data[0].title, 'DIFFERENT COURSE');
  assert.equal((await call(`${imported}/sections/30001/availability`)).body.data.seats_open, 3);
  assert.equal((await call(`/other-college/terms/${term.id}/sections/30001/availability`)).body.data.seats_open, 9);
  assert.equal((await call(`/other-college/terms/202670/courses`)).status, 404);
  assert.equal((await call(`${imported}/sections/99999/availability`)).status, 404);
  assert.equal((await call('/missing-school/terms')).status, 404);
});

test('unpublished terms are hidden and source requests use fixed URLs', async () => {
  const urls = [];
  const connectors = createConnectors({ now, fetcher: async (url, options) => {
    urls.push(url);
    assert.equal(options.redirect, 'error');
    return Response.json([{ termCode: '202750', termName: 'Summer 2027', termDisplayControl: 'N' },
      { termCode: term.id, termName: term.name, termDisplayControl: 'Y' }]);
  } });
  const { call } = setup({ connectors });
  assert.deepEqual((await call(`${base}/source-terms`, { role: 'owner' })).body.data, [term]);
  assert.equal((await call(`${base}/imports`, { method: 'POST', role: 'owner', json: { term_id: '202750' } })).status, 404);
  assert.ok(urls.every(url => url === 'https://prod-apiweb.pasadena.edu/api/getClassScheduleTerms'));
});

test('simultaneous imports share one fetch and successful imports have a cooldown', async () => {
  let imports = 0;
  const connectors = new Map([['pcc', { terms: async () => [term], importTerm: async () => {
    imports++;
    await new Promise(resolve => setImmediate(resolve));
    return catalog();
  } }]]);
  const { call } = setup({ connectors });
  const options = { method: 'POST', role: 'owner', json: { term_id: term.id } };
  const results = await Promise.all([call(`${base}/imports`, options), call(`${base}/imports`, options)]);
  assert.deepEqual(results.map(r => r.status), [200, 200]);
  assert.equal(imports, 1);
  assert.equal((await call(`${base}/imports`, options)).status, 429);
  assert.equal((await call(`${imported}/courses`)).body.data[0].code, 'MATH 005A');
});

test('bad upstream data and upstream errors preserve an existing import', async () => {
  const repository = new LocalRepository();
  await repository.importTerm(PCC_SCHOOL.id, catalog());
  for (const payload of [[], {}, [row({ termCode: '202670' })], [row(), row({ seatsAvail: '29' })]]) {
    const connectors = createConnectors({ now, fetcher: async url => Response.json(url.endsWith('getClassScheduleTerms')
      ? [{ termCode: term.id, termName: term.name, termDisplayControl: 'Y' }] : payload) });
    const { call } = setup({ repository, connectors });
    assert.equal((await call(`${base}/imports`, { method: 'POST', role: 'owner', json: { term_id: term.id } })).status, 503);
    assert.equal((await call(`${imported}/sections/30001/availability`)).body.data.seats_open, 3);
  }
  const { call } = setup({ repository, connectors: createConnectors({ fetcher: async () => { throw new Error('network failed'); } }) });
  assert.equal((await call(`${base}/source-terms`, { role: 'owner' })).status, 503);
});

test('missing counts stay null, zeros stay zero, and stale data is explicitly marked', async () => {
  const repository = new LocalRepository();
  await repository.importTerm(PCC_SCHOOL.id, catalog([row({ seatsAvail: '', waitCount: undefined, waitCapacity: '0', enrl: '-1' })]));
  let { call } = setup({ repository });
  let data = (await call(`${imported}/sections/30001/availability`)).body.data;
  assert.equal(data.seats_open, null);
  assert.equal(data.waitlist_count, null);
  assert.equal(data.waitlist_capacity, 0);
  assert.equal(data.enrolled, null);
  assert.equal(data.stale, false);
  ({ call } = setup({ repository, now: () => new Date(Date.parse(instant) + 300_000) }));
  data = (await call(`${imported}/sections/30001/availability`)).body.data;
  assert.equal(data.stale, true);
  assert.equal(data.as_of, instant);
});

test('local persistence can reopen school and term records; failed saves do not publish', async () => {
  let persisted;
  const repository = new LocalRepository(undefined, async data => { persisted = structuredClone(data); });
  await repository.importTerm(PCC_SCHOOL.id, catalog());
  const reopened = new LocalRepository(persisted);
  assert.equal((await reopened.section(PCC_SCHOOL.id, term.id, '30001')).availability.seats_open, 3);
  const failing = new LocalRepository(undefined, async () => { throw new Error('disk full'); });
  await assert.rejects(failing.importTerm(PCC_SCHOOL.id, catalog()), /disk full/);
  assert.equal(await failing.term(PCC_SCHOOL.id, term.id), null);
});

test('Supabase requests scope every catalog query to school and semester', async () => {
  const urls = [];
  const repository = new SupabaseRepository('https://project.supabase.co', 'sb_secret_test', async (url, options) => {
    urls.push(new URL(url));
    if(String(url).includes('bye_search_courses'))assert.deepEqual(JSON.parse(options.body),{p_school:'college-a',p_term:term.id,p_query:'calculus',p_offset:0,p_limit:21});
    assert.equal(options.headers.apikey, 'sb_secret_test');
    assert.equal(options.headers.authorization, undefined);
    return Response.json([]);
  });
  await repository.courses('college-a', term.id, 'calculus', 0, 21);
  await repository.sections('college-b', term.id, 'MATH-005A', 0, 21);
  await repository.section('college-b', term.id, '30001');
  for (const url of urls.slice(1)) {
    assert.equal(url.origin, 'https://project.supabase.co');
    assert.equal(url.searchParams.get('term_id'), `eq.${term.id}`);
    assert.ok(url.searchParams.get('school_id').startsWith('eq.college-'));
  }
  assert.equal(urls[1].searchParams.get('course_id'), 'eq.MATH-005A');
});

test('Supabase import is one scoped RPC and database failures do not leak details', async () => {
  let sent;
  const repository = new SupabaseRepository('https://project.supabase.co', 'secret', async (url, options) => {
    assert.equal(new URL(url).pathname, '/rest/v1/rpc/bye_import_term');
    sent = JSON.parse(options.body);
    return Response.json(null);
  });
  await repository.importTerm('college-a', catalog());
  assert.equal(sent.p_school_id, 'college-a');
  assert.equal(sent.p_sections.length, 1);
  const broken = new SupabaseRepository('https://project.supabase.co', 'secret', async () => Response.json({ message: 'private database detail' }, { status: 500 }));
  const { call } = setup({ repository: broken });
  const response = await call();
  assert.equal(response.status, 503);
  assert.ok(!JSON.stringify(response.body).includes('private database detail'));
});

test('CORS is limited to the configured frontend and responses are not publicly cached', async () => {
  const { call } = setup({ allowedOrigin: 'https://app.bye.test' });
  const allowed = await call('', { headers: { origin: 'https://app.bye.test' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.bye.test');
  assert.equal(allowed.headers.get('cache-control'), 'no-store');
  assert.equal((await call('', { headers: { origin: 'https://unrelated.test' } })).headers.get('access-control-allow-origin'), null);
});

test('malformed and oversized JSON bodies are rejected', async () => {
  const { handle } = setup();
  const send = payload => handle(new Request('https://bye.test/v1/schools', { method: 'POST',
    headers: { authorization: 'Bearer owner', 'content-type': 'application/json' }, body: payload }));
  assert.equal((await send('{')).status, 400);
  assert.equal((await send('[]')).status, 400);
  assert.equal((await send(JSON.stringify({ name: 'x'.repeat(9000) }))).status, 413);
});


test('PCC rejects oversized declared and streamed bodies before parsing', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  const declared = createConnectors({ fetcher: async () => new Response(body, {headers:{'content-length':String(33*1024*1024)}}) });
  await assert.rejects(declared.get('pcc').importTerm(term), {code:'invalid_source_data'});
  assert.equal(cancelled, true);
  let pulls = 0;
  const streamed = createConnectors({fetcher: async () => new Response(new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(600_000));},cancel(){cancelled=true;}}))});
  cancelled = false;
  await assert.rejects(streamed.get('pcc').terms(), {code:'invalid_source_data'});
  assert.equal(cancelled,true);
  assert.ok(pulls <= 3, 'must stop reading at the terms byte limit');
});

test('PCC bounds schedule rows and rejects conflicting canonical course metadata', () => {
  assert.throws(()=>normalizePccSchedule(Array(25_001).fill(row()),term.id,instant),{code:'invalid_source_data'});
  assert.throws(()=>normalizePccSchedule([row(),row({crn:'30002',courseTitle:'DIFFERENT TITLE'})],term.id,instant),{code:'invalid_source_data'});
  const normalized=normalizePccSchedule([row({subjCode:'MATH',courseNumbDisplay:'C005AH',fwSectOpenInd:'R'})],term.id,instant);
  assert.equal(normalized.courses[0].code,'MATH C005AH');
  assert.equal(normalized.sections[0].availability.source_status,'R');
});
test('readers may request the scoped refresh endpoint but cannot perform owner imports',async()=>{const repository=new LocalRepository();let requested;repository.requestRefresh=async(s,t)=>{requested=[s,t];return {status:'queued',last_successful_check:instant}};const {call}=setup({repository});assert.equal((await call('/pasadena-city-college/terms/202730/refresh',{method:'POST',json:{}})).status,202);assert.deepEqual(requested,['pasadena-city-college','202730']);assert.equal((await call('/pasadena-city-college/imports',{method:'POST',json:{term_id:'202730'}})).status,403);assert.equal((await call('/pasadena-city-college/terms/202730/refresh',{method:'POST',role:null,json:{}})).status,401)});
