# RMP privacy boundary and rollout plan

## Behavior

BYE verifies the session and membership internally. Student RMP endpoints then read
the shared cache only, including the legacy POST refresh endpoint. They do not
claim cache leases, contact RMP, enqueue work, or change scheduling priority.
Missing or older-than-90-day entries return `rmp_cache_miss` (409) without delaying
the schedule. Retained entries become visibly stale after seven days. Stale or
ambiguous candidate lists still require explicit profile selection.

The frontend sends selection, filter, cursor and limit in JSON POST bodies. Existing
GET clients and the old refresh URL remain supported. Professor identifiers still
appear in BYE paths. POST reduces query-string logging; it does not hide metadata
from the BYE server. Application and gateway logging policies remain separate work.

## Retrieval

The small `bye-rmp` Edge Function reuses the existing runtime, RMP client, cache,
distributed cache leases, global two-slot limiter, 60-attempt/minute budget,
Retry-After cooldown, bounded responses and HTTPS upstream. It uses the existing
cron credential for internal authorization and ignores the incoming body. It has
no student authentication or enrollment inputs. No separate hosting service is needed.

Every minute, the scheduler can claim one due catalog instructor from active PCC.
Only one background job runs at a time. A random UUID fences a three-minute job
lease; it is internal bookkeeping and is never sent to RMP. A successful job runs
again in seven days; failures and abandoned jobs become eligible after one hour.
The worker has a 110-second budget. Existing cache leases also coalesce retrieval
of the same cache key across instances. No student endpoint changes those deadlines.

Initial coverage deliberately bounds source work: up to three candidate search
pages, up to five candidate profiles, each profile preview and the first 20
unfiltered review records. It does not prefetch every course filter or later review
page. Those requests can use already-populated cache entries until expiry; otherwise
they return a cache miss. Expanding scheduled coverage needs a bounded catalog-derived
query plan, not a student-triggered fill queue. Very large/slow candidate sets can
exhaust the worker budget and retry; operators should monitor failed jobs.

The outbound RMP request is a fixed HTTPS POST, fixed GraphQL document, necessary
professor search/ID and review variables, and fixed JSON/accept/BYE user-agent
headers. It never copies incoming headers, JWTs, cookies, student IP forwarding,
student IDs, enrollment data, database credentials or internal job IDs. RMP still
sees BYE's server IP, professor identifiers and retrieval timing. This is identity
isolation, not full anonymity. Random-token-only or encrypted GraphQL bodies would
not be understood by RMP and are not used.

## Inspection evidence and deployment prerequisites

Inspected GitHub `main` at `409859fc47be50822210369636e1d727313f88cf`
and deployed `bye-api` version 26 before edits. The deployed `src/rmp.js` and
Edge entrypoint matched the repository exactly. The live `bye_rmp` SQL definition
matched the repository's 90-day/forced-refresh implementation. No secret values
were fetched and no live changes were made.

**Live source drift must be reconciled before deployment:** deployed `production.js`
and `education-plan.js` differ from main. Deployed watches-api.js,
watches-validation.js, education-references.js and education-checks.js are absent
from main. This branch does not import or replace that unrelated work. Deploying
the repository wholesale now could remove live features.

Review and execute separately after that reconciliation:

1. Apply `20261103194701_rmp_background_privacy.sql` in a test database, then through
   the normal reviewed migration process. It adds an RLS-protected service-only
   scheduling table and invoker RPC; it does not alter the existing cache function.
2. Deploy `bye-rmp` with its in-function cron authentication. The gateway JWT check
   is disabled like `bye-sync`; a normal student JWT must not authorize this endpoint.
3. Verify existing Vault URL uses HTTPS and the existing cron credential is present;
   apply `supabase/rmp-background-cron.sql`. Do not expose the credential to clients.
4. Verify scheduled fills and cache coverage before switching the API/frontend to
   cache-only reads. Keep the existing RMP enabled setting as the kill switch.
5. Monitor failure/due times and source cooldowns. Roll back scheduler invocation
   by unscheduling `bye-rmp-background`; disabling RMP stops reads and claims.

Nothing in this branch deploys functions, changes Vault secrets, enables RMP,
or installs the live cron job automatically.

## Verification

Tests cover fixed outbound payloads with hostile student metadata, cache-only
GET/POST/refresh and CORS, stale/expired data, scheduled cache filling, idle/failure
paths, scheduling deadlines, duplicate claims, fencing tokens, and browser role
denial. Existing RMP source validation, size bounds, cooldown and cache lease tests
remain in place. Scheduling SQL is exercised locally with PGlite, not production.

Supabase scheduling reference:
https://supabase.com/docs/guides/functions/schedule-functions
