# Cached RMP integration — development

Implemented October 30, 2026 in bye-dev. The extracted Swift files in Downloads were preserved. Query attribution is retained in `RMP_NOTICES.md`. No retired deployment or public hosting changed.

## Interface and operation

Membership-protected GET routes live under `/v1/schools/{school}/instructors/{uuid}/rmp/`:

- `candidates`: validated same-school candidates and whether bounded discovery was complete.
- `profile`: unique verified full-name match, an explicit selection state, or unmatched. Optional `profile_id` must belong to the candidate set.
- `reviews`: optional `profile_id`, exact source `filter`, opaque `cursor`, and `limit` from 1–20. Source IDs are included so blank comments and overlapping pages cannot distort pagination.

PCC is the supported source, with RMP school ID 2649 configured server-side. Unknown scores remain null. Source links and real check times remain visible. HTML in source text is displayed inertly, never inserted as HTML. No AI summaries. The frontend derives a BYE score from RMP rating and ease; original RMP values remain visible. This does not combine RMP with independent BYE student reviews.

Database-only cache uses six-hour freshness and 24-hour hard expiry, with labelled stale fallback on source failure. Cache fills and rate limits coordinate across instances through locked server-only SQL. Budget: 50 MiB payload, 5,000 cache entries, hourly cleanup. Source limits: two active leases, 100 ms grant spacing, 60 attempts/minute, three attempts maximum, 15-second fetch deadlines and a shared 25-second source-operation deadline. Source body reading stops before parsing at 4 MiB. Cooldowns are recorded before lease release, including final and long Retry-After failures.

Disable live RMP without affecting schedules:

```sql
update public.bye_rmp_settings set enabled=false where id;
```

Re-enable by setting `enabled=true`. These settings and cache tables have RLS and no browser grants. Operator credentials never enter the frontend. Browser review storage is in memory only; a confirmed profile choice stores only its ID locally.

## Development verification

Migration `20261031043108_rmp_cache.sql` is applied; bye-api version 6 is deployed. Live checks verified one PCC instructor/profile, initial three reviews, shared-cache reuse and one subsequent page of 20 reviews without overlap. Initial profile lookup took approximately 1,204 ms, cache hit 548 ms (subsequent hits 224–235 ms); next review page took 624 ms. No review text or credentials were recorded in application logs or this document. A real ambiguous case was not encountered in the bounded check; fictional ambiguity and truncated-search fixtures cover that path.

Platform shutdown samples for bye-api v4 recorded 66–85 ms CPU and approximately 11.25–11.30 MB memory at shutdown, without resource-limit termination. These are worker samples, not a peak-memory profile. Limits reference: https://supabase.com/docs/guides/functions/limits .

33 backend tests and 20 frontend tests pass, plus TypeScript and production build. Tests cover identity errors, GraphQL partial errors, ambiguity, truncated searches, streamed size bounds, Retry-After release, cache reuse/expiry/leases, browser denial, cancellation, cache separation, comparison ordering and inert text rendering. Existing schedule/access tests remain intact.

Security advisors report intentional no-policy information for backend-only RMP tables. Existing platform warnings for pg_net, Cron policies and password configuration remain; no browser permissions were added.

Frontend behavior: visible summaries load progressively; selecting a comparison sort resolves the rest before applying it. Reports preserve downloaded pages and filters through stored-seat refreshes. Reports expose source course labels, optional unambiguous PCC-course shortcuts, profile selection, original source links and up to 100 source records per filter per report session.

Live course filtering resolved the unambiguous PCC MATH 005A alias to source MATH5A and returned 10 reviews. The filter and all 10 reviews survived saved-count refresh and Guide/back navigation. Final v6 cached verification continued to return successful profile and pagination responses.

Browser acceptance passed at 390, 768 and 1440 pixels without horizontal overflow. Desktop visible rows loaded summaries progressively. The live chooser displayed source candidates and dismissal retained the selected review filter. Report screenshot: `exports/rmp-report.png`. Source request priority, in-memory coalescing and cancellation prevent obsolete report updates; no local persistent review bodies were added.

The v2.1 frontend adds a derived BYE score from rating/ease (50/50, ten pseudo-ratings toward 50), using `frontEnd/bye-web/src/byeScore.ts`. No backend contract or RMP cache changes were needed.
