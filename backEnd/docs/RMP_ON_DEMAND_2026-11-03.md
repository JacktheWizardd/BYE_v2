# BYE RMP on-demand rollout — November 3, 2026

## Why

The catalog crawler from PR #4 queued every PCC instructor row (2,886 jobs, 1,421 of
them name-only duplicates) and fetched on a fixed five-minute timer whether or not
anyone looked. For a private tool with a handful of users that is far more RMP
traffic than reader-driven fetching, and the most noticeable pattern BYE could
produce. The owner chose on-demand fetching with a long-lived shared cache.

## Sequence (all times UTC)

- 22:10 — last crawler job ran (old rules); last cache write 22:10:06.
- ~22:10 — applied `20261103230000_rmp_traffic_reduction` (scope, backoff, usage
  table). History recorded with `migration repair`. The new claim never ran.
- ~22:12 — paused cron `bye-rmp-background` at the owner's request.
- ~22:20 — locked fetching: revoked `service_role` execute on `bye_rmp` and
  `bye_rmp_background`. Cached ratings stayed readable.

## Deploy steps

1. Apply `20261103233000_rmp_on_demand.sql` with `supabase db query --remote -f`, then
   `supabase migration repair --remote --status applied 20261103233000`.
   `db push` is not used: nine earlier migrations are recorded live under different
   version numbers, so a push would try to re-run them.
2. `supabase functions deploy bye-api`. On-demand fetching starts here.
3. `supabase functions delete bye-rmp`.

Rollback: `update bye_rmp_settings set enabled=false` stops all RMP reads and source
contact.

## Notes

- The live database also has `education_plan_v3_guard` and `watches_workspace`
  migrations that are not in this repository; they were left untouched.
- The CLI could not download the shared `src/` modules of deployed functions (it
  refuses paths outside `supabase/functions`). The deployed entry files matched the
  repository; module parity relies on the read-back recorded in commit 3035cec.
