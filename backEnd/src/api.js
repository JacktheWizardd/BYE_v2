import { ApiError, requireValue } from './errors.js';
import { createConnectors, detectConnector, normalizeScheduleUrl } from './connectors.js';

function identifier(value, label) {
  requireValue(typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value), `Invalid ${label}.`);
  return value;
}

function pagination(params) {
  const limit = params.get('limit') ?? '20', cursor = params.get('cursor') ?? '0';
  requireValue(/^\d+$/.test(limit) && Number(limit) >= 1 && Number(limit) <= 100, 'limit must be between 1 and 100.');
  requireValue(/^\d+$/.test(cursor) && Number.isSafeInteger(Number(cursor)) && Number(cursor) <= 1_000_000, 'Invalid cursor.');
  return { limit: Number(limit), offset: Number(cursor) };
}

function page(rows, { offset, limit }) {
  return { data: rows.slice(0, limit), next_cursor: rows.length > limit ? String(offset + limit) : null };
}

function presentSchool(school) {
  const { id, name, aliases, schedule_url, connector, status, capabilities } = school;
  return { id, name, aliases, schedule_url, connector, status, capabilities };
}

function query(params) {
  const q = (params.get('q') ?? '').trim();
  requireValue(q.length <= 120 && !/[\u0000-\u001f]/.test(q), 'Search text must be at most 120 characters.');
  return q;
}

async function body(request) {
  requireValue(request.headers.get('content-type')?.split(';')[0].trim() === 'application/json', 'Use application/json.');
  // Bound reads even when Content-Length is missing or incorrect.
  const reader = request.body?.getReader();
  requireValue(reader, 'Provide a JSON body.');
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new ApiError(413, 'body_too_large', 'Request body is too large.'); }
    chunks.push(value);
  }
  try {
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    requireValue(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 'Provide a JSON object.');
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid_request', 'Invalid JSON.');
  }
}

// Web-standard Request/Response handler. Hosting adapters supply authorization;
// no request is authorized by default. Owners can set up sources and import data.
export function createApi({ repository, authorize = async () => null, connectors = createConnectors(),
  now = () => new Date(), allowedOrigin = null } = {}) {
  const imports = new Map(), completed = new Map();
  function response(request, data, status = 200, extraHeaders = {}) {
    const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
      'x-content-type-options': 'nosniff', ...extraHeaders };
    if (allowedOrigin && request.headers.get('origin') === allowedOrigin) {
      headers['access-control-allow-origin'] = allowedOrigin;
      headers.vary = 'Origin';
    }
    return new Response(status === 204 ? null : JSON.stringify(data), { status, headers });
  }
  return async function handle(request) {
    try {
      if (request.method === 'OPTIONS') {
        return response(request, null, 204, { 'access-control-allow-methods': 'GET, POST, OPTIONS',
          'access-control-allow-headers': 'Authorization, Content-Type' });
      }
      const principal = await authorize(request);
      if (!principal) throw new ApiError(401, 'unauthorized', 'A valid session is required.');
      const url = new URL(request.url), params = url.searchParams;
      let parts;
      try { parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean).map(decodeURIComponent); }
      catch { throw new ApiError(400, 'invalid_request', 'Invalid URL encoding.'); }
      const readerLoad=request.method==='POST'&&parts.length===6&&parts[0]==='v1'&&parts[1]==='schools'&&parts[3]==='terms'&&parts[5]==='load'&&!!repository.semesters;
      if(request.method!=='GET'&&principal.role!=='owner'&&!readerLoad)throw new ApiError(403,'forbidden','Owner access is required.');
      if (parts[0] !== 'v1' || parts[1] !== 'schools') throw new ApiError(404, 'not_found', 'Endpoint not found.');
      if (parts.length === 2 && request.method === 'GET') {
        const p = pagination(params);
        const rows = await repository.schools(query(params), p.offset, p.limit + 1);
        return response(request, page(rows.map(presentSchool), p));
      }
      if (parts.length === 2 && request.method === 'POST') {
        const input = await body(request);
        requireValue(typeof input.name === 'string' && input.name.trim().length >= 2 && input.name.trim().length <= 160,
          'School name must contain 2 to 160 characters.');
        const id = input.id ?? input.name.trim().toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        requireValue(typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) && id.length <= 80, 'Provide a valid school id.');
        const aliases = input.aliases ?? [];
        requireValue(Array.isArray(aliases) && aliases.length <= 10 && aliases.every(a => typeof a === 'string' && a.trim().length > 0 && a.length <= 80),
          'aliases must contain at most 10 nonempty names, each at most 80 characters.');
        let scheduleUrl = normalizeScheduleUrl(input.schedule_url);
        const connector = detectConnector(scheduleUrl);
        if (connector === 'pcc') scheduleUrl = 'https://findclasses.pasadena.edu/';
        const supported = connector !== null && connectors.has(connector);
        const capabilities = supported ? connectors.get(connector).capabilities : null;
        const school = await repository.addSchool({ id, name: input.name.trim(), aliases: [...new Set(aliases.map(a => a.trim()))],
          schedule_url: scheduleUrl, connector: supported ? connector : null,
          status: supported ? 'setup_required' : 'pending',
          capabilities: { schedules: capabilities?.schedules === true,
            seats: capabilities?.seats === true, waitlists: capabilities?.waitlists === true } });
        return response(request, { data: presentSchool(school) }, 201);
      }
      if (parts.length < 3) throw new ApiError(405, 'method_not_allowed', 'Method not allowed.');
      const schoolId = identifier(parts[2], 'school ID');
      const school = await repository.school(schoolId);
      if (!school) throw new ApiError(404, 'school_not_found', 'School not found.');
      if (parts.length === 3 && request.method === 'GET') return response(request, { data: presentSchool(school) });
      if (school.status === 'disabled') throw new ApiError(409, 'school_disabled', 'This school is disabled.');
      const connector = connectors.get(school.connector);
      if (!connector) throw new ApiError(409, 'connector_required', 'This school is saved but needs a verified schedule connector.');
      if(repository.semesters&&parts[3]==='terms'){
        if(parts.length===4&&params.get('scope')==='published'&&request.method==='GET'){
          const p=pagination(params),rows=await repository.semesters('list',{school_id:schoolId});
          return response(request,page(rows.slice(p.offset,p.offset+p.limit+1),p));
        }
        if(parts.length===6&&['load','status'].includes(parts[5])){
          const action=parts[5],termId=identifier(parts[4],'semester ID');
          if(request.method!==(action==='load'?'POST':'GET'))throw new ApiError(405,'method_not_allowed','Method not allowed.');
          const data=await repository.semesters(action,{school_id:schoolId,term_id:termId});
          if(data.error)throw new ApiError(404,data.error,'Select a published semester.');
          return response(request,{data},action==='load'&&!data.imported?202:200);
        }
      }
      if (parts.length === 4 && parts[3] === 'source-terms' && request.method === 'GET') {
        if (principal.role !== 'owner') throw new ApiError(403, 'forbidden', 'Owner access is required.');
        return response(request, { data: await connector.terms() });
      }
      if (parts.length === 4 && parts[3] === 'imports' && request.method === 'POST') {
        const input = await body(request), termId = identifier(input.term_id, 'semester ID');
        if (repository.enqueue) return response(request, { data: await repository.enqueue(schoolId, termId) }, 202);
        const importKey = JSON.stringify([schoolId, termId]);
        if (!imports.has(importKey)) {
          const last = completed.get(importKey);
          if (last !== undefined && now().getTime() - last < 60_000) {
            throw new ApiError(429, 'refresh_limited', 'This semester was just imported. Wait at least 60 seconds.');
          }
          const operation = (async () => {
            const term = (await connector.terms()).find(t => t.id === termId);
            if (!term) throw new ApiError(404, 'term_not_found', 'PCC has not published this semester.');
            const catalog = await connector.importTerm(term);
            await repository.importTerm(schoolId, catalog);
            completed.set(importKey, now().getTime());
            return { school_id: schoolId, term: catalog.term, courses: catalog.courses.length, sections: catalog.sections.length };
          })();
          imports.set(importKey, operation);
        }
        const operation = imports.get(importKey);
        try { return response(request, { data: await operation }); }
        finally { if (imports.get(importKey) === operation) imports.delete(importKey); }
      }
      if (request.method !== 'GET') throw new ApiError(405, 'method_not_allowed', 'Method not allowed.');
      if (parts.length === 4 && parts[3] === 'terms') {
        const p = pagination(params);
        return response(request, page(await repository.terms(schoolId, p.offset, p.limit + 1), p));
      }
      if (parts[3] !== 'terms' || parts.length < 6) throw new ApiError(404, 'not_found', 'Endpoint not found.');
      const termId = identifier(parts[4], 'semester ID');
      if (!await repository.term(schoolId, termId)) throw new ApiError(404, 'term_not_imported', 'This semester has not been imported for this school.');
      if (parts.length === 6 && parts[5] === 'courses') {
        const p = pagination(params);
        return response(request, page(await repository.courses(schoolId, termId, query(params), p.offset, p.limit + 1), p));
      }
      if (parts.length === 6 && parts[5] === 'sections') {
        if (repository.touch) await repository.touch(schoolId, termId);
        const p = pagination(params), course = params.has('course_id') ? identifier(params.get('course_id'), 'course ID') : null;
        return response(request, page(await repository.sections(schoolId, termId, course, p.offset, p.limit + 1), p));
      }
      if (parts.length === 8 && parts[5] === 'sections' && parts[7] === 'availability') {
        const section = await repository.section(schoolId, termId, identifier(parts[6], 'section ID'));
        if (!section) throw new ApiError(404, 'section_not_found', 'Section not found in this school and semester.');
        const refresh = repository.touch ? await repository.touch(schoolId, termId) : null;
        const availability = section.availability;
        const age = now().getTime() - Date.parse(availability?.as_of);
        return response(request, { data: { school_id: schoolId, term_id: termId, section_id: section.id, ...availability, refresh_status: refresh, last_successful_check: availability?.as_of ?? null,
          stale: !Number.isFinite(age) || age < 0 || age >= 300_000 } });
      }
      throw new ApiError(404, 'not_found', 'Endpoint not found.');
    } catch (error) {
      if (error instanceof ApiError) return response(request, { error: { code: error.code, message: error.message } }, error.status,
        error.status === 429 ? { 'retry-after': '60' } : {});
      return response(request, { error: { code: 'internal_error', message: 'The request could not be completed.' } }, 500);
    }
  };
}
