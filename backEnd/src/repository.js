export const codeAlias = value => value.toLowerCase().replace(/[^a-z0-9]/g,'').replace(/([a-z])0+(?=[0-9])/g,'$1');
export function courseRank(c,q){
 const text=q.trim().toLowerCase(),alias=codeAlias(text),code=c.code.toLowerCase();
 if(code===text)return 0;
 if(alias&&codeAlias(code)===alias)return 1;
 if(text&&code.split(/\s+/)[0]===text)return 2;
 if(alias&&codeAlias(code).startsWith(alias))return 3;
 if(text&&c.title.toLowerCase().startsWith(text))return 4;
 return 5;
}
export function courseMatches(c,q){const text=q.trim().toLowerCase(),alias=codeAlias(text);return !text||text.split(/\s+/).every(word=>`${c.code} ${c.title}`.toLowerCase().includes(word))||!!alias&&codeAlias(c.code).includes(alias)}
import { ApiError } from './errors.js';
import { PCC_SCHOOL } from './connectors.js';

export const searchText = school => [school.name, ...school.aliases, new URL(school.schedule_url).hostname].join(' ').toLowerCase();
const key = (school, term) => JSON.stringify([school, term]);

// Local development only. Mutations serialize, and a failed disk save leaves the
// previous in-memory snapshot intact. The server supplies atomic file persistence.
export class LocalRepository {
  constructor(state = { schools: [PCC_SCHOOL], catalogs: {} }, save = async () => {}) {
    this.state = structuredClone(state);
    this.save = save;
    this.queue = Promise.resolve();
  }
  mutate(change) {
    const operation = this.queue.then(async () => {
      const next = structuredClone(this.state);
      const result = change(next);
      await this.save(next);
      this.state = next;
      return structuredClone(result);
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async schools(q, offset, limit) {
    return structuredClone(this.state.schools.filter(s => searchText(s).includes(q.toLowerCase()))
      .sort((a, b) => a.id.localeCompare(b.id)).slice(offset, offset + limit));
  }
  async school(id) { return structuredClone(this.state.schools.find(s => s.id === id) ?? null); }
  async addSchool(school) {
    return this.mutate(state => {
      if (state.schools.some(s => s.id === school.id || s.schedule_url === school.schedule_url)) {
        throw new ApiError(409, 'school_exists', 'This school ID or schedule URL is already saved.');
      }
      state.schools.push(school);
      return school;
    });
  }
  async terms(school, offset, limit) {
    return structuredClone(Object.values(this.state.catalogs).filter(c => c.school_id === school)
      .map(c => c.term).sort((a, b) => b.id.localeCompare(a.id)).slice(offset, offset + limit));
  }
  async term(school, term) { return structuredClone(this.state.catalogs[key(school, term)]?.term ?? null); }
  async courses(school, term, q, offset, limit) {
    return structuredClone((this.state.catalogs[key(school, term)]?.courses ?? [])
      .filter(c => courseMatches(c,q))
      .sort((a, b) => courseRank(a,q)-courseRank(b,q)||a.id.localeCompare(b.id)).slice(offset, offset + limit));
  }
  async sections(school, term, course, offset, limit) {
    return structuredClone((this.state.catalogs[key(school, term)]?.sections ?? [])
      .filter(s => !course || s.course_id === course).sort((a, b) => a.id.localeCompare(b.id)).slice(offset, offset + limit));
  }
  async section(school, term, id) {
    return structuredClone(this.state.catalogs[key(school, term)]?.sections.find(s => s.id === id) ?? null);
  }
  async importTerm(school, catalog) {
    await this.mutate(state => {
      const previous = state.catalogs[key(school, catalog.term.id)];
      if (previous && Date.parse(previous.term.as_of) > Date.parse(catalog.term.as_of)) {
        throw new ApiError(409, 'older_snapshot', 'An older import cannot replace a newer snapshot.');
      }
      state.catalogs[key(school, catalog.term.id)] = { school_id: school, ...catalog };
      const found = state.schools.find(s => s.id === school);
      if (!found) throw new ApiError(404, 'school_not_found', 'School not found.');
      found.status = 'active';
      return catalog.term;
    });
  }
}

function pattern(q) { return `%${q.replace(/[\\%_*]/g, '\\$&')}%`; }

// Uses only server credentials. No dependency on an SDK or hosting runtime.
export class SupabaseRepository {
  constructor(url, secretKey, fetcher = fetch) {
    this.base = new URL('/rest/v1/', url);
    this.secretKey = secretKey;
    this.fetcher = fetcher;
  }
  /** @param {string} path @param {Record<string, string | number>} query @param {{method?: string, body?: unknown, prefer?: string, signal?: AbortSignal}} options */
  async request(path, query = {}, { method = 'GET', body, prefer, signal } = {}) {
    const url = new URL(path, this.base);
    url.search = new URLSearchParams(query).toString();
    const headers = { apikey: this.secretKey, accept: 'application/json', 'content-type': 'application/json' };
    if (this.secretKey.startsWith('eyJ')) headers.authorization = `Bearer ${this.secretKey}`;
    if (prefer) headers.prefer = prefer;
    try {
      const response = await this.fetcher(url, { method, headers,
        body: body === undefined ? undefined : JSON.stringify(body), signal: signal ?? AbortSignal.timeout(30_000) });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) {
        if (data?.code === '23505') throw new ApiError(409, 'school_exists', 'This school ID or schedule URL is already saved.');
        throw new Error('Database request failed');
      }
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'database_unavailable', 'The database is unavailable or has not been configured.');
    }
  }
  async schools(q, offset, limit) {
    return this.request('bye_schools', { select: '*', search_text: `ilike.${pattern(q)}`, order: 'id.asc', offset, limit });
  }
  async school(id) { return (await this.request('bye_schools', { select: '*', id: `eq.${id}`, limit: 1 }))[0] ?? null; }
  async addSchool(school) {
    return (await this.request('bye_schools', {}, { method: 'POST', prefer: 'return=representation',
      body: school }))[0];
  }
  async terms(school, offset, limit) {
    return this.request('bye_terms', { select: 'id,name,as_of', school_id: `eq.${school}`, order: 'id.desc', offset, limit });
  }
  async term(school, id) {
    return (await this.request('bye_terms', { select: 'id,name,as_of', school_id: `eq.${school}`, id: `eq.${id}`, limit: 1 }))[0] ?? null;
  }
  async courses(school, term, q, offset, limit) {
    return this.request('rpc/bye_search_courses', {}, {method:'POST',body:{p_school:school,p_term:term,p_query:q,p_offset:offset,p_limit:limit}});
  }
  async sections(school, term, course, offset, limit) {
    return this.request('bye_section_catalog', { select: 'id,course_id,units,instructors,meetings,availability',
      school_id: `eq.${school}`, term_id: `eq.${term}`, ...(course ? { course_id: `eq.${course}` } : {}), order: 'id.asc', offset, limit });
  }
  async section(school, term, id) {
    return (await this.request('bye_section_catalog', { select: 'id,course_id,units,instructors,meetings,availability',
      school_id: `eq.${school}`, term_id: `eq.${term}`, id: `eq.${id}`, limit: 1 }))[0] ?? null;
  }
  async importTerm(school, catalog) {
    await this.request('rpc/bye_import_term', {}, { method: 'POST',
      body: { p_school_id: school, p_term: catalog.term, p_courses: catalog.courses, p_sections: catalog.sections } });
  }
}
