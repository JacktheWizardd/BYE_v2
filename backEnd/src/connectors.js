import { ApiError, requireValue } from './errors.js';

export const PCC_SCHOOL = {
  id: 'pasadena-city-college',
  name: 'Pasadena City College',
  aliases: ['PCC', 'Pasadena'],
  schedule_url: 'https://findclasses.pasadena.edu/',
  connector: 'pcc',
  status: 'setup_required',
  capabilities: { schedules: true, seats: true, waitlists: true },
};

export function normalizeScheduleUrl(value) {
  requireValue(typeof value === 'string' && value.length <= 2048, 'Provide a schedule_url.');
  let url;
  try { url = new URL(value); } catch { throw new ApiError(400, 'invalid_request', 'Invalid schedule URL.'); }
  requireValue(url.protocol === 'https:' && !url.username && !url.password && !url.port,
    'Use a public HTTPS schedule URL without credentials or a custom port.');
  const host = url.hostname;
  requireValue(host.includes('.') && !host.includes(':') && !/^\d+(\.\d+){3}$/.test(host)
    && !host.endsWith('.localhost') && !host.endsWith('.local') && !host.endsWith('.internal'),
  'Use a public school hostname.');
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

// Detection never fetches an owner-supplied URL. Each supported connector uses
// fixed, reviewed upstream hosts; arbitrary URLs remain pending.
export function detectConnector(url) {
  const parsed = new URL(url);
  return parsed.hostname === 'findclasses.pasadena.edu' && parsed.pathname === '/' ? 'pcc' : null;
}

function count(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function time(value) {
  const raw = String(value ?? '');
  if (!/^\d{4}$/.test(raw) || Number(raw.slice(0, 2)) > 23 || Number(raw.slice(2)) > 59) return null;
  return `${raw.slice(0, 2)}:${raw.slice(2)}`;
}

function uniqueObjects(values) {
  return [...new Map(values.map(value => [JSON.stringify(value), value])).values()];
}

export function normalizePccSchedule(rows, termId, asOf) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 25_000) {
    throw new ApiError(503, 'invalid_source_data', 'PCC returned no verifiable schedule records. Existing data was retained.');
  }
  const courses = new Map(), sections = new Map();
  for (const row of rows) {
    if (!row || row.termCode !== termId || !/^\d{5}$/.test(row.crn ?? '')
      || !['subjCode', 'courseNumbDisplay', 'courseTitle'].every(field => typeof row[field] === 'string' && row[field].trim())
      || !/^[a-zA-Z0-9_-]+$/.test(row.subjCode) || !/^[a-zA-Z0-9_-]+$/.test(row.courseNumbDisplay)) {
      throw new ApiError(503, 'invalid_source_data', 'PCC returned an unexpected section or semester. Existing data was retained.');
    }
    const courseId = `${row.subjCode}-${row.courseNumbDisplay}`;
    if (courses.has(courseId) && courses.get(courseId).title !== row.courseTitle) {
      throw new ApiError(503, 'invalid_source_data', 'PCC returned inconsistent course metadata. Existing data was retained.');
    }
    courses.set(courseId, { id: courseId, code: `${row.subjCode} ${row.courseNumbDisplay}`, title: row.courseTitle });
    const availability = {
      seats_open: count(row.seatsAvail), enrolled: count(row.enrl), capacity: count(row.maxEnrl),
      waitlist_count: count(row.waitCount), waitlist_capacity: count(row.waitCapacity),
      waitlist_open: count(row.waitAvail), source_status: row.fwSectOpenInd ?? null,
      as_of: asOf,
    };
    const section = sections.get(row.crn) ?? {
      id: row.crn, course_id: courseId, units: /^\d+(\.\d+)?$/.test(String(row.creditHrLow ?? '')) ? Number(row.creditHrLow) : null,
      instructors: [], meetings: [], availability,
    };
    if (section.course_id !== courseId || JSON.stringify(section.availability) !== JSON.stringify(availability)) {
      throw new ApiError(503, 'invalid_source_data', 'PCC returned inconsistent records for one section. Existing data was retained.');
    }
    for (const prefix of ['pfa', 'sfa']) {
      const name = row[`${prefix}Name`];
      if (typeof name === 'string' && name.trim()) section.instructors.push({ name: name.trim(), ...(typeof row[`${prefix}Email`] === 'string' && row[`${prefix}Email`].trim() ? { email: row[`${prefix}Email`].trim().toLowerCase() } : {}) });
    }
    section.meetings.push({
      days: ['monDay', 'tueDay', 'wedDay', 'thuDay', 'friDay', 'satDay', 'sunDay']
        .flatMap((field, index) => row[field] ? [index + 1] : []),
      start_time: time(row.beginTime), end_time: time(row.endTime),
      start_date: row.ptrmStartDate?.slice(0, 10) ?? null,
      end_date: row.ptrmEndDate?.slice(0, 10) ?? null,
      timezone: 'America/Los_Angeles', format_code: typeof row.schdCode === 'string' ? row.schdCode : null, format: row.schdDesc ?? null,
      campus: row.campDesc ?? null, building: row.bldgDesc ?? null, room: row.roomCode ?? null,
    });
    sections.set(row.crn, section);
  }
  return {
    courses: [...courses.values()],
    sections: [...sections.values()].map(section => ({ ...section,
      instructors: uniqueObjects(section.instructors), meetings: uniqueObjects(section.meetings) })),
  };
}

export function createConnectors({ fetcher = fetch, now = () => new Date() } = {}) {
  async function getJson(path, maxBytes) {
    let response;
    try {
      response = await fetcher(`https://prod-apiweb.pasadena.edu/api/${path}`, {
        headers: { accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) { const error = new ApiError(503, 'source_unavailable', 'PCC could not be checked.'); const retry = response.headers.get('retry-after'); error.retrySeconds = Math.max(0, Number(retry) || Math.ceil((Date.parse(retry) - Date.now()) / 1000) || 0); throw error; }
      // Bound the actual decoded response too: Content-Length can be absent or
      // describe compressed bytes. Never parse an unbounded semester download.
      const tooLarge = () => new ApiError(503, 'invalid_source_data', 'PCC returned an oversized response. Existing data was retained.');
      if (Number(response.headers.get('content-length')) > maxBytes) {
        await response.body?.cancel();
        throw tooLarge();
      }
      if (!response.body) throw new ApiError(503, 'invalid_source_data', 'PCC returned an empty response.');
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let size = 0, text = '';
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > maxBytes) { await reader.cancel(); throw tooLarge(); }
          text += decoder.decode(value, {stream: true});
        }
        text += decoder.decode();
      } finally { reader.releaseLock(); }
      return JSON.parse(text);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(503, 'source_unavailable', 'PCC could not be checked. Existing data was retained.');
    }
  }
  const pcc = {
    capabilities: { schedules: true, seats: true, waitlists: true },
    async terms() {
      const rows = await getJson('getClassScheduleTerms', 1024 * 1024);
      if (!Array.isArray(rows) || rows.some(row => !row || !/^\d{6}$/.test(row.termCode ?? '') || typeof row.termName !== 'string')) {
        throw new ApiError(503, 'invalid_source_data', 'PCC returned an unexpected semester list.');
      }
      return rows.filter(row => row.termDisplayControl === 'Y')
        .map(row => ({ id: row.termCode, name: row.termName })).sort((a, b) => b.id.localeCompare(a.id));
    },
    async importTerm(term) {
      const rows = await getJson(`classSchedule/${encodeURIComponent(term.id)}`, 32 * 1024 * 1024);
      const asOf = now().toISOString();
      return { term: { ...term, as_of: asOf }, ...normalizePccSchedule(rows, term.id, asOf) };
    },
  };
  return new Map([['pcc', pcc]]);
}
