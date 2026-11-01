# Schedule discovery: development rollout

Implemented October 30, 2026. Frontend changes remain in `frontEnd/bye-web`; backend changes remain in `backEnd`. No public hosting or v1 deployment changes.

Ranked course search preserves published identities and applies stable ranking before pagination. The server-only search RPC is denied to browser roles. Meetings preserve nullable PCC `format_code`; online filtering requires explicit evidence. Confirmed asynchronous meetings with no scheduled times/days pass the day filter. Navigation preserves online selection and the saved semester. Results begin with a neutral overview. Seat aggregates deduplicate sections and show stale/incomplete states.

The worker reserves `next_fetch_at` atomically before source work. The five-minute global deadline covers owner jobs, previews and retries. Failures and expired leases cannot clear it; longer upstream delays extend it. Existing ten-minute activity expiry remains.

Migration `20261031033859_schedule_discovery.sql` was generated through the Supabase CLI and aligned to the remote migration timestamp after application. API version 3 and sync version 2 deployed successfully in bye-dev.

## Verification

- 24 backend tests and 15 frontend tests pass, with TypeScript and production build. PostgreSQL checks include ranking, prefix identity, cooldown, extended retry delays, expired leases and denied browser RPC access.
- Real Cron-processed catalog job `dc2be8bd-4296-4f1f-9f20-375df49cf0b9` succeeded: 1,099 courses, 3,153 sections, 3,398 ms through staging; atomic publication completed.
- Browser checks confirmed actual shorthand suggestions, keyboard selection, neutral overview and online-filter URL state using the existing ordinary device session.
- Security advisors retain platform warnings for pg_net, Cron policies and password configuration; BYE tables intentionally deny browser access. No new client grants.

## Runtime measurements

The job's `Deno.memoryUsage().rss` field returns zero and is not a valid measurement. Platform `function_logs` provide independent evidence: execution `8add25c3-1561-43eb-9011-c969c89a2d3a` logs the successful catalog job, then shutdown with 287 ms CPU and 11,118,711 bytes total memory (heap 8,086,904; external 3,031,807). Boot-to-success was approximately 5.7 seconds, including publication. The worker also served an idle tick before shutdown. Shutdown memory is an observed sample, not a measured peak. No resource-limit shutdown occurred. These measurements are within the documented 256 MB, 150-second Free-plan wall time and 2-second CPU limits: https://supabase.com/docs/guides/functions/limits . Re-measure after source size/batching changes.

Responsive browser acceptance passed at 390, 768 and 1440 pixels for overview/report without horizontal overflow. Online ACCT 001A returned a confirmed asynchronous section. Copy CRN showed confirmation, browser back returned to the neutral overview and forward restored the selected instructor. Screenshot: `exports/schedule-discovery.png`.

Automatic availability job `bb983cb5-a543-4535-8f92-8291ac8a0611` subsequently succeeded at 03:46:03 UTC (October 30, 8:46 PM Pacific), after the catalog job's global deadline. It processed 3,153 sections in 2,635 ms through staging and advanced `last_success` only on success. The next due time became 03:51:03 UTC. This verifies a deployed import followed by a demand-driven scheduled refresh without bypassing the cooldown.

## Search relevance follow-up

The subject-only query `MATH` previously tied subject matches with incidental title matches, so alphabetically earlier AHSD/BUS courses occupied the suggestion limit. Migration `20261031035202_course_search_relevance.sql` now ranks exact display code, normalized exact code, exact subject, normalized code prefix, title prefix, then remaining matches before stable-ID pagination. Multiword title search accepts words in either order. Punctuation-only queries do not match every course. The migration is deployed; the existing API RPC requires no Edge redeployment.

Input now converts typed letters to uppercase. The dropdown separates code/title, has bounded scrolling, shows more-match guidance, closes on blur/Escape, and provides searching/no-results/error feedback. Browser checks confirmed uppercase MATH, MATH-first suggestions, shorthand selection, arrow/Enter selection, no-results feedback and no horizontal overflow at 390/768/1440. All 25 backend and 15 frontend tests, TypeScript and production build pass. Screenshot: `exports/search-improved.png`.
