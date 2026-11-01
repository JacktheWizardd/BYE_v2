# bye-dev deployment record

Project: [bye-dev dashboard](https://supabase.com/dashboard/project/yjcrupbibflagchcdeun)
Organization: BYE. Region: US West (Northern California). Organization plan: Free.
API base: `https://yjcrupbibflagchcdeun.supabase.co/functions/v1/bye-api/v1`.

The schema, Vault configuration, bye-api and bye-sync Edge Functions, anonymous
Auth, owner membership, and minute-tick Cron are configured. Migrations in this
checkout use the version numbers returned by the deployed migration history.

Runtime configuration uses Supabase-injected project keys plus Vault-only invite
and Cron secrets; no project service key was downloaded into the source tree.
The first owner's Auth session is saved to `.owner-session.json` with mode 0600,
ignored by version control. It is sensitive and expires; do not paste it into chat.
No frontend origin is configured yet, so browser CORS is closed until frontend wiring.

## Verification on October 30, 2026

- Scheduled live PCC Spring 2027 import: 1,099 courses, 3,153 sections, successful
  first attempt. Worker elapsed time: 1,923 ms.
- Platform shutdown telemetry for the sync instance: CPU time used 222 ms;
  reported memory total 11,028,079 bytes. This is platform-reported shutdown
  telemetry, not a peak-memory guarantee. Application Deno memory metrics returned
  zero in this runtime, so use platform telemetry rather than that placeholder.
- A subsequent Cron-triggered availability refresh succeeded on its first attempt.
  Later Cron ticks continued without additional availability jobs after viewers
  became idle, verifying the activity cutoff.
- Live owner login, course search, and availability reads passed.
- Auth-only users denied until invite redemption. A single invite concurrently
  redeemed by two users produced one success only. Failed-invite limits enforced.
- Owner-only routes denied to friends. Invite revocation denied the next API call.
- Direct authenticated Data API reads and runtime-secret RPC calls denied.
- Local suite: 21 tests passed, including PostgreSQL tests. Deno adapter checks passed.

## Advisor findings

Added missing foreign-key indexes and a primary key for attempts. All application
tables intentionally have RLS and no client policies: clients use the authenticated
BYE API instead of direct table access. The corresponding no-policy notices are
expected. Scheduler schema usage is revoked from public/anon/authenticated roles.

Supabase's non-relocatable pg_net extension remains in its managed installation
schema and triggers an [extension placement advisory](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public).
Managed Cron policies may also be flagged for anonymous-role applicability despite
schema usage being revoked. Password leak protection is disabled; BYE's configured
login flow is anonymous/invite-based and has no passwords. These are recorded rather
than represented as a completely clean advisor report.

## Remaining product work

Connect the frontend to the deployed API and set its exact CORS origin. Keep the
owner session private. Additional school connectors, ratings, and notifications are
not included. The five-minute freshness target measures BYE checks, not upstream
PCC publication frequency.
