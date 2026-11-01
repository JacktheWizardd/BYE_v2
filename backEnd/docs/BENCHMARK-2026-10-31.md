# BYE loading and API benchmark — 2026-10-31

The demonstrated improvement is fewer schedule requests during report navigation. Five identical browser cycles completed **4 → 2 sections reads** and **35 → 33 total API requests** each. Opening a report and returning through browser history now reuse the existing course subscription. Manual Refresh all, the 60-second stored-data poll, visibility/offline handling, membership checks and source freshness are unchanged.

First useful report content remained about **96 ms**. Empty-memory comparison ordering was **4,132 ms → 3,942 ms** at the median, with overlapping ranges; this is not evidence of a general latency improvement. No database/index/auth optimization was justified by this run.

## Setup and versions

- Existing free bye-dev project `yjcrupbibflagchcdeun`, database in us-west-1; no resource/hosting changes.
- macOS 27.0.1 (26A434), Node 24.22.1, Apple desktop CPU details in raw JSON; Chrome 156 in the in-app browser. The default timing viewport was 1280 px. No network/CPU throttling or simulated mobile hardware. Actual connection bandwidth/ISP were not measured.
- Vite production preview temporarily used `http://localhost:5173`. Two disposable anonymous readers were redeemed through owner-created invites: one for Node and one through the real browser UI. Their sessions remained separate from normal browser Auth.
- Initial API baseline used instrumentation versions 7/8; version 9 corrected the review cache-only stale classification. Version 10 added explicit cache/full-source stage durations. The clean reference repeats both use version 10 and the same data/paths. Backend logic was not optimized between those repeats.
- Browser before build: `index-QI4QD-ue.js`; supplemental before build `index-C4tDet2p.js`. Optimized browser build: `index-D1gj_8vZ.js`. Instrumentation differences between these builds add resource diagnostics, not UI behavior. Final normal build: `index-BCdoFy64.js`, SHA256 `4ef33b9a86ba428a279267a3cdf6e2d3497cdc1f5085e8c4a1539ac3839d472c`.
- Dataset: Spring 2027 / 202730, 1,099 courses and 3,153 sections; MATH 005A has 34 sections / 26 instructor groups; ABE 3001 has 1 section, ENGL C1000 has 80. Source counts/timestamps can change naturally during the benchmark.

## API measurements

Each cell is **p50 / p95 milliseconds**. Every route has 30 measured requests at each reader level, after three excluded warmups. A/B are clean repeated controls on the same backend version; the frontend-only fix cannot improve these server endpoints. Throughput and per-stage p50/p95 are in `analysis.json`; status counts, bytes and raw timings are retained.

| Route | A: 1 reader | B: 1 reader | A: 5 | B: 5 | A: 10 | B: 10 | Decoded payload bytes (B) |
|---|---:|---:|---:|---:|---:|---:|---:|
| me | 112 / 208 | 101 / 202 | 110 / 211 | 91 / 146 | 110 / 140 | 90 / 107 | 192 |
| schools | 126 / 183 | 114 / 138 | 136 / 482 | 115 / 160 | 120 / 154 | 128 / 531 | 271 |
| semesters | 148 / 184 | 137 / 181 | 165 / 276 | 153 / 314 | 185 / 533 | 140 / 203 | 106 |
| search | 203 / 339 | 201 / 454 | 271 / 331 | 281 / 459 | 258 / 428 | 257 / 518 | 390 |
| sections | 246 / 677 | 275 / 415 | 299 / 437 | 278 / 380 | 269 / 384 | 291 / 765 | 22169 |
| sections-small | 213 / 335 | 219 / 306 | 262 / 337 | 270 / 548 | 289 / 1494 | 283 / 355 | 616 |
| sections-large | 217 / 333 | 232 / 372 | 276 / 397 | 309 / 633 | 271 / 338 | 265 / 368 | 52083 |
| rmp-profile | 178 / 246 | 196 / 321 | 191 / 515 | 227 / 472 | 188 / 320 | 205 / 780 | 1349 |
| rmp-reviews | 182 / 255 | 184 / 245 | 199 / 270 | 230 / 321 | 225 / 455 | 197 / 252 | 8645 |

Both clean repeats: **810/810 measured responses HTTP 200**, zero timeouts, zero measured 429/5xx, no safety-stop threshold reached. Throughput was limited deliberately by the 105 ms start spacing and sample concurrency: roughly 3.5–9.6 requests/s in repeat B, not maximum capacity. Payload bytes are decoded UTF-8 JSON lengths, not network-compressed transfer sizes.

The initial baseline review stage correctly returned 409 for an entry older than six hours; it is retained as a cache-miss diagnostic, not a successful cached-review measurement. The corrected stage returns the previously validated 20-review page with a stale label (within the 24-hour hard expiry). `before-reviews-corrected.json` and the clean repeats replace that comparison. No caches were cleared.

### Server handling evidence

| Repeat B, 10 readers | Auth p50 | Membership p50 | DB work p50 | RMP cache p50 | Total handler p50 |
|---|---:|---:|---:|---:|---:|
| me | 20 | 22 | 22 | 0 | 44 |
| search | 34 | 40 | 166 | 0 | 198 |
| sections | 36 | 43 | 196 | 0 | 242 |
| rmp-profile | 30 | 24 | 161 | 55 | 159 |
| rmp-reviews | 27 | 23 | 157 | 53 | 140 |

Durations are milliseconds. Stages overlap: membership/cache are included in DB, and parallel DB timings are summed. They must not be added to total. Total starts inside the configured handler, after runtime secret initialization; source timing includes gate/attempt/read/parse work. Auth timing covers the Auth HTTP verification; membership remains a fresh DB lookup on every request.

Most server time is database round trips, but no query-plan/index regression was established. Unused-index advisories alone do not justify deleting integrity/access indexes. Large sections payload is about 52 KB and did not consistently dominate latency. Request-to-request and p95 variation are large enough that additional tuning needs a larger controlled follow-up.

## Browser measurements

Five runs per row. Values are median **[min–max] ms**. Click-to-render milestones use two animation frames after React updates. Report opening is from comparison with populated browser memory; deep links reload the document and empty that memory.

| Scenario | Cache | Before | After |
|---|---|---:|---:|
| comparison | empty-memory | 4132 [3573–4818] | 3942 [3575–4599] |
| report | populated-memory | 96 [96–97] | 96 [95–96] |
| review-page | empty-page-memory | 320 [302–429] | 296 [270–337] |
| revisit | populated-memory | 95 [93–96] | 95 [94–96] |
| refresh | populated-memory | 263 [231–328] | 362 [296–363] |
| comparison | populated-memory | 91 [88–94] | 90 [89–94] |
| report-deep-link | empty-memory | 1072 [928–1422] | 1142 [891–1348] |

| Cold-memory comparison milestone | Before median | After median |
|---|---:|---:|
| sections-ready | 308 | 348 |
| first-rating | 642 | 582 |
| comparison-ready | 4132 | 3942 |

The comparison resolves 26 outcomes through the existing two-request browser queue; the cold comparison phase makes 27 calls (sections plus summaries). Warm navigation reuses browser memory. The report initially contains three reviews; the cached next page produces **23 displayed/retrieved records**. Those 23 remain after refresh and return navigation. Five repeat page loads start from empty page memory; loaded-page restoration is measured separately, not presented as a fresh additional page download.

Captured per-phase request deltas can race a pending response. The final timeline per flow is authoritative: all five baseline flows contain four completed sections calls and 35 total completed API calls; all five optimized flows contain two and 33. The original effect also aborted a redundant request during rapid history navigation; aborted browser requests are not represented as completed timing rows.

## Cache, sources and network limits

- Repeated/concurrent workloads use reader-gated cache-only mode. It reads validated backend cache entries and still validates candidate/profile choice and school identity. Fresh is <6h; stale content is allowed only <24h and remains labelled stale. Missing/hard-expired entries return 409 without any upstream call.
- This development read path does not update cache LRU or run cache-fill coordination. Its concurrent timings characterize shared-cache reads, not normal coordinator lock contention or cold-fill capacity. Existing distributed cache/gate database tests remain passing.
- One naturally missing profile succeeded in **1,414 ms**, including **901 ms** source work. Its naturally missing review page succeeded in **452 ms**, including **145 ms** source work. No cache was evicted. The operation graph enforces a conservative **15 upstream-attempt maximum including retries**; actual attempt count was not separately logged, so it is not claimed. Public names/review bodies/credentials are absent from timing JSON.
- Three synthetic CORS OPTIONS probes returned 204 for the exact origin in approximately 188/145/49 ms. These are not browser preflight counts. Node API timings exclude automatic browser preflight; browser marks include any browser preflight delay. Cross-origin Resource Timing can redact transfer/TTFB details without Timing-Allow-Origin; zero there is unavailable, not zero cost.
- Browser Auth SDK session retrieval was sub-millisecond in the captured runs; the initial `/me` network verification is separate. Rendering/frame markers and queue completion are distinct from API total. Runtime initialization and network paths are outside handler timings. Logs show workers in us-west-1 and ap-northeast-1; slow first calls are **not labelled cold starts** without request-to-boot correlation.
- Natural PCC availability jobs succeeded at 20:34/20:40/20:46 UTC with recorded source/staging durations 2,482/2,996/1,948 ms. The workflow touches activity normally; no import was forced or cooldown bypassed.
- Sample API worker shutdown totals were about **10.9–11.0 MB** and **40–44 ms CPU**. They are worker shutdown samples, not request-specific peaks. PCC job RSS telemetry reports unavailable. Compare cautiously against the documented 256 MB / 150 s free worker wall / 2 s request CPU limits: https://supabase.com/docs/guides/functions/limits .
- Workload accounting: 1,882 scripted API calls in the baseline family (initial + correction + clean repeat), 1,783 in the after family (initial + clean repeat), including warmups/guards. Conservative additional browser/diagnostic upper bounds are baseline ≤2,497 and after ≤2,458; the ledger is in `metadata.json`. The reusable limiter additionally tests that Retry-After releases cannot burst queued readers. No live stage encountered throttling. The UI recorder had an early wait boundary and a recorder binding error; discarded cycles are included in these bounds, not in the five-run result rows.
- The first initial API baseline overlapped browser setup; the first after API run briefly overlapped the two-call source experiment. Treat those initial exploratory files as diagnostics. Clean reference repeats were isolated from interactive browser workloads. The source cache changed through the one legitimate experiment; comparison/profile/review benchmark targets were unchanged.

## Verification and cleanup

- **40 backend + 41 frontend tests pass**, including database security/distributed gates, ranking/pagination, all eleven BYE-score vectors, unknown values and cache-only no-source/disabled-mode regressions. TypeScript passes. The final normal production build passes (480.38 KB JS, 139.17 KB gzip).
- The five-run browser navigation check is the regression check for duplicate subscriptions: no report/revisit sections calls after the change, without losing the manual refresh. Reviews retain 23 records, the overview stays neutral, and 34 sections / 26 instructor rows remain.
- 390/768/1440 viewport report and comparison checks saved under `exports/benchmark`; no horizontal overflow, score-column collisions or clipped sort labels. Sort controls are 44px high; keyboard Tab from Refresh all reaches Copy CRN. These are desktop viewport tests, not physical phone performance measurements. No CSS/design change was made.
- Security advisors retain previously existing platform warnings (pg_net public schema, Cron anonymous policies, password protection). Backend-only RLS tables intentionally have no browser policies. No new schema/grants were added.
- **Both disposable memberships revoked (2/2)**; API reader `/me` denied afterward; browser reader locally signed out. Private benchmark session/invite files removed. Owner credentials never entered the frontend.
- Final bye-api deployment **v11**, configuration allowlist **null**. Normal `/me` returns 200 without custom auth/DB timing; benchmark parameter returns 403. Frontend rebuilt without VITE_BENCHMARK and normal Vite dev restored on localhost:5173. No public hosting or retired deployments touched.

## Reuse

See `backEnd/scripts/benchmark/README.md` for setup, commands, safety stops and cleanup. Raw sanitized measurements, derived statistics, source probes and platform observations are under `exports/benchmark`. `node backEnd/scripts/benchmark/analyze.mjs` regenerates the statistical summary. This light-load sample does not establish a capacity limit or a reliable broad speedup.
