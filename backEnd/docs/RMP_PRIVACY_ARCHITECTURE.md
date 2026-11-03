# RMP privacy boundary: on-demand fetching

## Goal

BYE makes as few RMP requests as possible while keeping students' identity away from
RMP. It is a small private tool, so there is no catalog crawl: RMP is contacted only
when a reader opens a professor who is not in the shared cache, and that result then
serves every reader.

## Behavior

BYE verifies the session and membership internally before any RMP route runs.

- **Candidates, profile and reviews reads** use the shared cache. A fresh entry is
  returned with no source contact. A missing entry is fetched once by BYE's server,
  published to the cache and returned. Concurrent readers of the same key share one
  cache lease; a reader that finds the lease busy gets the previous data or a short
  `rmp_pending` retry.
- **Freshness:** entries are fresh for six months. Opening an older entry refetches
  it; if RMP fails, the previous data is returned and marked stale. Professors nobody
  opens are never refetched.
- **Retention:** review entries are evicted after one year (hourly `bye-rmp-cleanup`
  and on publish), or earlier under the existing 5,000-entry / 50 MiB cap, least
  recently used first.
- **Refresh button** (`/rmp/refresh`, labelled "Reload cached RMP") reads the cache
  only. It never contacts RMP; a missing or year-old entry returns `rmp_cache_miss`
  (409). Cache-only reads mark data stale after 180 days.
- **Identity:** a professor is auto-matched only for a non-provisional name with a
  complete search and exactly one exact name match. Otherwise the reader chooses, and
  only the chosen profile is fetched. A profile read is the first reviews page (20
  records), so one query and one cache entry serve both. A first view typically costs
  two source requests: one name search and one profile.

The frontend sends selection, filter, cursor and limit in JSON POST bodies; GET is
still supported. Professor identifiers appear in BYE paths. POST reduces
query-string logging; it does not hide metadata from the BYE server.

## Limits

All source attempts pass `bye_rmp('acquire')` first:

- at most two concurrent attempts, 100 ms spacing and 60 attempts per minute;
- Retry-After cooldowns from RMP are honoured (up to 24 hours);
- a hard daily ceiling, `bye_rmp_settings.daily_request_cap` (default 200 attempts
  per Pacific day). Past the cap, reads return cached data where available and
  otherwise `rmp_limited` until the next day.

`bye_rmp_usage` records granted source attempts per Pacific day. It holds counts
only: no reader, professor or request data. Kill switch: `bye_rmp_settings.enabled`
set to false stops all RMP reads and source contact.

## What RMP can and cannot see

The outbound request is a fixed HTTPS POST to RMP's GraphQL endpoint with a fixed
query document, the professor search text or ID and review variables, and fixed
JSON/Accept/`BYE/2` user-agent headers. It never includes incoming headers, JWTs,
cookies, student IP forwarding, student IDs, enrollment data, database credentials
or internal lease tokens.

RMP still sees BYE's server IP, which professors are looked up, and when. Because a
fetch happens when a reader opens an uncached professor, the timing follows reader
activity, but RMP cannot tell which reader. This is identity isolation, not
anonymity. BYE does not disguise itself (no browser impersonation, proxies or IP
rotation); staying low-volume and polite is the intended way to remain unobtrusive.

## History

- PR #4 (Nov 3, 2026) moved all retrieval into a catalog-driven background job
  (`bye-rmp` Edge Function, `bye-rmp-background` cron, `bye_rmp_background` queue).
  That produced far more source traffic than reader-driven fetching for this
  user base. See `RMP_ROLLOUT_2026-11-03.md` and `AUDIT_2026-11-03.md`.
- `20261103230000_rmp_traffic_reduction` added scope, backoff and usage counts to that
  job; it was paused the same day.
- `20261103233000_rmp_on_demand` removes the crawler (cron, queue table, scope and
  claim functions), restores reader-driven fetching with six-month freshness and
  one-year retention, and adds the daily cap. The `bye-rmp` function is deleted.
  See `RMP_ON_DEMAND_2026-11-03.md`.

## Verification

Tests cover: fixed outbound payloads with hostile incoming metadata; one fetch per
uncached professor and none for cached reads; the refresh route never contacting RMP;
CORS; six-month freshness and stale fallback; one-year eviction; the daily cap and
usage counting; removal of the crawler objects; and browser-role denial. Existing
source validation, size bounds, Retry-After cooldown and cache-lease tests remain.
SQL is exercised locally with PGlite, not production.
