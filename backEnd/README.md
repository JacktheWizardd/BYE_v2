# BYE backend

Supabase Edge Functions + Postgres + Cron. All backend work belongs in `backEnd`.
PCC is the first supported connector; school search
searches the saved directory, not the web. Unsupported schedule URLs remain pending.

## Development deployment

`bye-dev` is deployed in US West under the BYE organization. Project reference:
`yjcrupbibflagchcdeun`. See `supabase/deployment.json` for public URLs and
[DEPLOYMENT.md](DEPLOYMENT.md) for verification and remaining frontend work.
The database migrations and Edge Functions are applied, anonymous Auth is enabled,
and a Cron-triggered PCC import succeeded. Local tests also pass against embedded
PostgreSQL. The React frontend in `frontEnd/bye-web` connects to this development API.

See [v1 lessons](docs/V1_LESSONS.md) for the historical decisions applied to v2,
local source-download safeguards, and remaining rollout work.

## Development

Requires Node 22+ and pnpm. Install locked dev dependencies with `pnpm install --frozen-lockfile`,
then `pnpm test` (or `node --test`). PGlite is only a development dependency.

For the old single-process local prototype, copy `.env.example` to `.env`, set
separate 32+ character `BYE_OWNER_TOKEN` and `BYE_READ_TOKEN`, and run
`node --env-file-if-exists=.env src/server.js`. It binds to loopback and persists
`.data/catalog.json`. This runner retains synchronous manual imports and development
bearer tokens; it does not emulate production Auth, jobs, or Cron. The production
handler is `src/production.js`, with the Edge adapters under `supabase/functions`.

## Fresh development project setup

1. Create/connect the intended development Supabase project. No paid resources are
   automatically provisioned by this repository. Inspect any existing tables before
   applying this fresh-project migration; do not run the obsolete `setup.sql`.
2. With the official Supabase CLI, run `supabase link`, then `supabase db push` from
   `backEnd`. The versioned migration seeds PCC and creates normalized catalog,
   access, jobs, staging, and refresh tables. Run database security advisors.
3. Enable anonymous Auth sign-ins in the hosted project's Auth settings. Local
   `supabase/config.toml` also enables them. Clients use anonymous Auth plus a redeemed
   BYE invite; an anonymous Auth account alone grants no BYE access.
4. Configure Edge secrets using `supabase secrets set --env-file <private-file>`:
   `BYE_DATABASE_SECRET` (backend secret key), `BYE_PUBLISHABLE_KEY`,
   `BYE_INVITE_PEPPER` (random 32+ characters), `BYE_CRON_SECRET` (independent random
   32+ characters), and `BYE_ALLOWED_ORIGIN` (exact frontend origin).
   `SUPABASE_URL` is supplied by Supabase. Never ship database secrets, pepper,
   cron secrets, or owner credentials to the frontend. Pepper rotation invalidates
   existing unused invite codes and the configured owner-code hash. Keep the secret file outside source control.
5. Deploy `supabase functions deploy bye-api` and `supabase functions deploy bye-sync`.
   Gateway JWT checking is disabled in config because the API verifies Auth through
   `/auth/v1/user` and checks membership per request; the sync function requires its
   separate cron bearer secret. Keep these checks enabled in the application code.
6. Provision the first owner using the server-only command:
   `node --env-file=.env scripts/bootstrap-owner.js .owner-session.json`.
   Supply `SUPABASE_URL`, `BYE_DATABASE_SECRET`, and `BYE_PUBLISHABLE_KEY` locally.
   Credentials are written once to a private file rather than printed. Owner access
   lasts 30 days; recovery/renewal uses the trusted project administrator. Friends
   use replacement invites if their stored anonymous session is lost.
7. Store `bye_project_url` and `bye_cron_secret` in Supabase Vault, matching the
   deployed project and sync secret. Run `supabase/cron.sql` in the SQL editor after
   deployment. It invokes the worker every minute; database due times determine
   the five-minute active-semester refresh interval. Re-running the named schedule
   updates that job. Restrict access to Vault and pg_net's request queue.

## Production interface

Base URL: `https://<project>.supabase.co/functions/v1/bye-api/v1`.
Use the Supabase user's access JWT in `Authorization: Bearer ...`.

- `POST /auth/invites/redeem` accepts `{ "code": "XXXX-XXXX" }` from a verified
  anonymous Auth user. Redemption is atomic, single-use, and grants 30 days of access.
  Three failed attempts in a minute lock the actor/user; codes are HMAC-hashed.
- `GET /me` reports the current membership. Expired/revoked membership is denied
  on every request even if its Auth JWT has not expired.
- Owner: `GET/POST /admin/invites`, POST accepts optional `note`; generated codes
  are returned once. Lists exclude hashes and full codes.
- Owner: `POST /admin/invites/:id/revoke` revokes the invite and its issued access.
- `GET /schools?q=PCC`, `POST /schools` (owner), `GET /schools/:school`.
  Creation accepts `name`, `schedule_url`, optional slug `id`, and `aliases`.
- Owner: `GET /schools/:school/source-terms`, `POST /schools/:school/imports`
  with `term_id`. Imports return **202** and a job record, replacing the draft's
  synchronous production contract.
- Owner: `POST /schools/:school/test-source` with `term_id` queues a preview job;
  `POST /schools/:school/activate` queues a validated first import;
  `POST /schools/:school/disable` disables reads and future refreshes.
- Owner: `GET /admin/jobs/:jobId` returns status, safe failure code, and runtime
  metrics. Successful preview jobs include a small source sample in their metrics.
- `GET /schools/:school/terms` lists imported semesters.
- `GET /schools/:school/terms/:term/courses?q=calculus` searches course code/title.
- `GET /schools/:school/terms/:term/sections?course_id=MATH-005A` lists sections.
- `GET /schools/:school/terms/:term/sections/:id/availability` returns stored
  counts, source status, check timestamp, stale flag, and refresh timing state.

Existing list routes retain `data`, `next_cursor`, default limit 20, max 100.
Unknown counts stay null. `as_of` means BYE finished fetching, not PCC's own update
instant. Availability becomes stale after five minutes. Meeting times retain their
local timezone. Instructor identities use school-scoped published email when
available; name-only identities stay provisional and section-scoped.

## Synchronization and safety

Workers claim a database lease shared across function instances. Only one PCC fetch
can run at once. The lease token is required to stage, publish, or fail a job; an
expired worker cannot publish. Successful catalog publication updates normalized
records and latest availability in one transaction. A fast job updates only known
sections' availability. Absent sections are retained for owner reconciliation.

Reading sections or availability records activity. Polling stops after ten idle
minutes. Metadata imports run daily for enabled imported terms. Five-minute refreshes
share one whole-semester source request across all viewers; PCC's currently verified
endpoint returns approximately 10.6 MB. Failures preserve prior counts and timestamps,
retry with exponential backoff and upstream Retry-After, and stop after three attempts
per job. The scheduler may create a subsequent run after the cooldown.

Record job outcomes and duration/memory metrics. Never log tokens or invite codes.
The draft's JSON-file runner remains a local aid, not a deployment alternative.

## Required cloud acceptance checks

- Redeem two concurrent requests for one invite: only one succeeds. Check expiry,
  revocation, owner-only routes, and anonymous/Auth-only access denial.
- Confirm publishable-key Data API calls cannot read or mutate API-only tables,
  views, or privileged RPCs. Run security/performance advisors.
- Import an actual published PCC semester, check representative sections and meeting
  times, rerun without duplicates, and verify stable instructor identities.
- Invoke concurrent workers and confirm one upstream fetch. Verify idle stop,
  retries, preview non-publication, and old-data preservation after source failures.
- Measure deployed CPU, wall time, and memory in Supabase logs/dashboard for the
  actual PCC import and refresh. `duration_ms` in job metrics is elapsed wall time,
  not a CPU measurement. If limits are exceeded, stop rollout and revise processing;
  do not silently change hosting or claim background tasks remove runtime limits.
- Observe a real Cron-triggered refresh and verify five-minute stale behavior before
  connecting the frontend. Ratings, notifications, and additional connectors remain
  outside this change.

## Connector-based runtime configuration

The deployed adapters use Supabase-injected project keys (modern key maps with
legacy-key fallback). `vault_runtime` creates the invite pepper and cron secret
in Supabase Vault and exposes them only through a service-role-only invoker RPC.
Explicit `BYE_DATABASE_SECRET` and `BYE_PUBLISHABLE_KEY` environment overrides
remain supported. `BYE_ALLOWED_ORIGIN` is optional until a frontend origin exists;
without it browser cross-origin requests are not enabled. The API still requires
a valid Auth token and current membership. SQL functions never return secrets to
an anonymous or authenticated client. Secret rotation requires restarting or
redeploying functions because runtime configuration is cached per instance.

The first owner session is in `.owner-session.json` with owner-only file permissions
and is ignored by source control. Treat it as a password; never paste it into chat.

Schedule discovery additions and verification: [development rollout](docs/SCHEDULE_DISCOVERY.md).

Cached RMP routes and operations: [integration record](docs/RMP_INTEGRATION.md).


Reusable owner-code access, owner invite management, trusted configuration and verification: [OWNER_ACCESS.md](docs/OWNER_ACCESS.md).
