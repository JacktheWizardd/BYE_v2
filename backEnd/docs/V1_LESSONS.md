# V1 lessons carried into v2

Reviewed 2026-10-30 from the canonical documentation in `JacktheWizardd/BYE_frontend`
and `JacktheWizardd/BYE_backend`. These are historical records, not instructions
to restore old deployments or override the current v2 plan. File hashes below pin
the documents read even if their main branches change.

## Decisions and reasons

| V1 finding | Why it mattered | V2 decision |
| --- | --- | --- |
| Published course codes have leading zeros, suffixes and CCN prefixes. | Shortened display identities and guessed matches can select the wrong class. | Keep official IDs/codes and explicit school/semester scope. Shorthand search remains a follow-up; never rewrite canonical identities. |
| A section can have several meetings and several instructors. | Flattening rows loses day restrictions or assigns the wrong professor. | Keep every meeting and stable instructor link; filter all meetings and deduplicate totals. Existing v2 tests cover these rules. |
| PCC status and seat counts are separate facts; undocumented codes are uncertain. | A seat number cannot prove permission to register; guessed status labels can mislead. | Preserve counts, nulls and raw status. Remove guessed `R = Reserved` and `X = Cancelled` labels. Show `Source status: R/X` until verified. |
| Large/malformed downloads and inconsistent records must fail before publication. | One bad response must not replace the last good catalog. | Add actual streamed-body limits: 32 MiB schedule, 1 MiB terms, 25,000 schedule rows. Reject conflicting titles for one canonical course. Retain the existing 30-second source timeout, staging and atomic publication. |
| A client must have a finite, single in-flight availability reader. | Stalled requests, repeated cursors and independent pollers can hang a screen or multiply traffic. | Add a 35-second browser request deadline, repeated-cursor/shape checks and a 250-page ceiling. Publish totals only after all pages succeed. |
| Availability refresh must preserve the screen and pause offline/hidden. | Background traffic wastes requests; transient failures should not erase usable results. | One reader per screen, abort on departure/hidden/offline, resume on return, retry failures with exponential backoff and honour `Retry-After`. Success returns to the 60-second saved-data cadence. |
| Professor identity matching was ambiguous; rating/review provenance and automated summaries caused problems. | A plausible-looking match or summary can still be wrong. | Keep provisional identities visible. Ratings, reviews, RMP matching and AI summaries remain disabled in this phase. |
| The original website was intentionally shut down after earlier launch decisions. | Earlier deployment instructions no longer describe the intended public state. | Leave v1 hosting, shutdown responses and desktop update endpoints untouched. Apply lessons only to the v2 workspace. |
| Shared UI/domain logic had drifted across platforms. | Duplicated rules created repeated fixes and inconsistent screens. | Keep the current React components and typed API/data helpers as the v2 source. Do not import legacy Electron/Tauri/native shells or replace the approved v2 handoff with the older redesign. |

Current v2 access remains anonymous Supabase Auth plus invite membership. The old
application-key delivery model is not a replacement for individual access checks.
Current v2 freshness remains five minutes; the old API's fifteen-minute stale-count
policy is not imported. Refresh rereads stored data and does not imply a fresh PCC fetch.

## Follow-up engineering work identified

- Add shorthand course lookup (`math5a` → published `MATH 005A`) with exact-match
  ranking and CCN/suffix test vectors. Keep it in the backend so all future clients
  share the same identity rules.
- Extend the shared worker lease with a persisted next-fetch deadline. V1 explicitly
  limited *all* semester-fetch starts, including owner imports/retries, to one per
  five minutes. V2's normal cadence and concurrency lease are present, but that is
  not yet a global start-rate guarantee for manually queued jobs.
- Verify archived-semester behavior against authoritative dates before adding any
  archive policy; a historical offering is not evidence of current availability.
- Re-measure the deployed worker after changes to source size or batching. Bounds
  reduce risk but are not measurements of Edge execution time or peak memory.

These follow-ups require separate implementation/rollout checks; they are not
represented as completed by this review. No migrations or remote deployment were
performed in this pass. The new connector safeguards are local until redeployed.

## Sources read

- [Schedule API operations and client contract](https://github.com/JacktheWizardd/BYE_backend/blob/main/services/schedule-api/docs/guide.md), blob `b6affa08f0ad5b5a403ebc2a51af2ad26691c001`.
- [Implementation history](https://github.com/JacktheWizardd/BYE_backend/blob/main/docs/project/IMPLEMENTATION_HISTORY.md), blob `a027a11367671521481e275ad17fb44a9759c099`.
- [PCC schedule pilot](https://github.com/JacktheWizardd/BYE_backend/blob/main/docs/schedules/pcc-schedule-pilot.md), blob `09b441ca66631bc6dd4a51acc9179ec2067fbecd`.
- [Data-access decision record](https://github.com/JacktheWizardd/BYE_frontend/blob/main/docs/operations/DATA_ACCESS.md), blob `d140153d6a13fe40e33970899af7976695d0be2c`. Read dated decisions chronologically, including later pauses.
- [Intentional website shutdown](https://github.com/JacktheWizardd/BYE_frontend/blob/main/docs/operations/WEBSITE_UNAVAILABLE.md), blob `78169736763c90b1d5d4f8145b58965be0110111`.
- [October 19 app redesign](https://github.com/JacktheWizardd/BYE_frontend/blob/main/docs/web-app/APP_REDESIGN_PLAN.md), blob `2ff2d196a2b886921eed4af3882b414d8be52a22`.

Also reviewed both repository documentation indexes, the schedule API README,
architecture, delivery and handoff records, and the frontend web/shared/core package
overviews. This is a documentation-led review, not an exhaustive audit of v1 source.

## Validation for this pass

- Backend: 23 tests, including embedded PostgreSQL publication/access/lease checks
  and new streamed-size/row-count/conflicting-course checks.
- Frontend: 12 tests for API pagination, cancellation, request deadlines, status
  uncertainty, identity/meetings, and refresh visibility/connectivity/backoff.
- TypeScript check and production Vite build pass.
- No new live PCC fetch was needed for these deterministic failure cases. Browser
  automation was unavailable during this pass; deployed worker validation was not rerun.

## Subsequent schedule-discovery implementation

Shorthand ranked lookup and the persisted global fetch deadline are now implemented and deployed in the development project. See [schedule discovery verification](SCHEDULE_DISCOVERY.md) for tests, browser acceptance, real import/scheduled-refresh evidence and runtime measurements. Archive lifecycle remains deferred.
