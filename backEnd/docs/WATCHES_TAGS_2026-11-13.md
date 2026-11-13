# Watches: tagged sections — November 13, 2026

Source only. Nothing in this change was deployed; see "Deploy" below.

## What changed

A student can tag a section on a professor's report as **watching** and see it laid over their Plan
in the Watches tab before committing to it. A watched section is never part of the Plan.

- `src/weekly-plan.js`
  - Each semester's Plan may carry an optional `watching` array. Entries follow exactly the same
    rules as `sections` (one shared check), with unique CRNs and at most `WATCH_LIMIT` (30).
  - Study hours still belong only to classes in `sections`.
  - `refreshPlans(plans, lookup, strict)` replaces units, meetings and instructors with the school's
    current section for `sections` and `watching` alike, and returns the `school:term:id` keys of
    sections the school no longer lists. `strict` rejects a section filed under another course.
- `src/production.js`: `/v1/me/plan` calls `refreshPlans` when saving (strict) and when reading, in
  place of the two inline loops. Behaviour for `sections` is unchanged; `missing_sections` now also
  names watched sections that are no longer listed.
- No database change. `bye_weekly_plans.plans` is JSON and `bye_weekly_plan` stores what the API
  validated; the 1 MB row check and the 200,000-character per-semester check still apply.
- `/v1/me/backup` uses the same validator, so it accepts `watching` too. It still refreshes only
  `sections`; the web app does not call that route.

## Not part of this change

The live watches API (`src/watches-api.js`: followed professors, events, ed-plan matching) is
untouched and still unused by the web app. Its database functions are not in this repository. The
saved-professors list, ed-plan "My courses" and "New since you looked" remain on hold until the ed
plan import lands.

## Deploy

Backend first, then the frontend.

```sh
supabase functions deploy bye-api
```

```sh
cd frontEnd/bye-web && pnpm run deploy:cloudflare
```

If the frontend goes out first, pressing Watch returns "Invalid weekly Plan backup." and nothing is
saved; ordinary Plan saves keep working because the app sends `watching` only when it is non-empty.
A frontend from before this change keeps `watching` intact when it saves a Plan, because it sends
back the week it read.

Rollback: redeploy the previous `bye-api`. Plans that already hold `watching` would then be refused
on their next save, so untag everything in Watches first, or roll the frontend back with it.

## Verification

- `node --test` in `backEnd`: 74 tests pass, including validation of `watching` (accepted,
  malformed, duplicate, over the limit, unknown key) and `refreshPlans` (both lists refreshed,
  missing sections reported once, course mismatch refused when saving).
- Not checked: the deployed function, the live database and a signed-in session.
