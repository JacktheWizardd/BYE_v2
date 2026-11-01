# BYE React frontend

React + TypeScript + Vite implementation of the supplied v2 handoff. Original
frontend reference folders are unchanged. This app connects to the bye-dev API;
RMP ratings and original reviews use the membership-protected backend cache. Weekly Plans are saved to the authenticated device session; Watches remains deferred. Owner sign-in and invite management are available.

Run from this folder with Node 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
pnpm build
pnpm test
```

Open http://localhost:5173. The backend allows this exact development origin.
Public configuration values are in `.env.example`; only publishable credentials
belong in VITE variables. No owner session or backend secret is bundled.

Use a real owner-issued invite. Anonymous Supabase authentication alone does not
grant access. The SDK stores the device session under its own storage key; local
search preferences and recent searches use `bye-web:` keys. Prototype unlock flags
and sample credentials are ignored. Locking the device signs out locally and needs
a fresh invite to return. Retain the supplied ZIP as the design reference.

Course codes and semester IDs are the published API values. All section pages are
loaded before totals are shown. Every meeting is retained; unknown days do not pass
a day filter. Counts are snapshots, unknown counts stay unknown, and the displayed
check time does not advance merely because Refresh was clicked. While visible,
results reread stored sections every minute; the server controls actual source refresh.
Polling pauses when hidden or offline, backs off failures, and resumes on return.
API requests have a finite deadline; pagination rejects repeated or malformed cursors
instead of displaying partial totals. Undocumented source codes retain their raw value.

Validation: TypeScript and production build pass, with 48 frontend and 46 backend tests.
The hosted browser smoke test covers invite redemption, shorthand course search,
neutral comparison, instructor reports, Copy CRN, session restoration and exact-origin CORS.
Responsive checks at 390, 768 and 1440 pixels are recorded in the benchmark report.
The frontend is hosted on Cloudflare; see deployment details below.

Visual polish follows `BYE v2 mockup.pdf`: the amber-highlighted guide heading,
AE86 frame, compact invite form, three-step route, numbers legend, search form,
instructor comparison rows, stat tiles, and section layout. Real values replace
sample content; unconnected ratings remain dashes. Guide and report overflow checks
passed at 390, 768, and 1440 pixels after the visual update.

The [v1 lessons record](../../backEnd/docs/V1_LESSONS.md) documents the historical
decisions applied here, source references, and work still to carry forward.

Schedule discovery includes shorthand search, online-only filtering, confirmed asynchronous day handling, a neutral course overview, saved semesters and explicit stale totals. See [verification](../../backEnd/docs/SCHEDULE_DISCOVERY.md).

RMP implementation, controls and development evidence: [integration record](../../backEnd/docs/RMP_INTEGRATION.md).

V2.1 adds a derived BYE score (50% RMP rating, 50% ease, ten pseudo-ratings toward 50), professor prefix search, reversible sorts, seat occupancy bars and shared schedule sync states. It is distinct from independent BYE student reviews. Five-minute freshness remains unchanged; Refresh all only rereads saved counts. The corrected reference is in `frontEnd/mockups`.


Loading/API benchmark results and reproduction commands: [2026-10-31 report](../../backEnd/docs/BENCHMARK-2026-10-31.md). `VITE_BENCHMARK=true` is an explicit temporary measurement build; the normal build has no benchmark DOM output or alternate Auth key. Same-course comparison/report navigation retains one availability subscription.


## Cloudflare hosting

Live frontend: **https://bye-web-v2.jack-truong2k1.workers.dev**. This is a new static-assets Worker named `bye-web-v2`; it does not replace v1. Supabase bye-dev continues to serve Auth, memberships, schedule data and RMP. No API/session/review responses are cached by the frontend host. The app remains invite-only.

From `frontEnd/bye-web`, with Node 24 and pnpm 11.25.0:

```sh
pnpm install --frozen-lockfile
pnpm run deploy:cloudflare
```

Wrangler is pinned to 4.156.0. The checked-in native build approvals cover only esbuild and Cloudflare workerd. The deploy command type-checks, builds, checks for benchmark/private assets, and uploads `dist` using `wrangler.jsonc`. It requires an authorized Cloudflare CLI login (`pnpm exec wrangler whoami`). Account and Worker names are explicit to avoid deploying into another project. `preview_urls` is disabled; previews are not granted API access.

`.env.production` contains only public project configuration and disables benchmark mode. The publishable key is intentionally public; never add service-role keys, owner sessions or RMP credentials. HTML revalidates every visit. Fingerprinted JS/CSS use an immutable browser cache; local fonts/images revalidate normally. `public/_headers` also provides CSP, frame restrictions and noindex metadata.

For a local Cloudflare preview, stop the Vite dev server first, then run `pnpm run preview:cloudflare` and open **http://localhost:5173**. The ordinary `pnpm run dev` command remains unchanged. Both use the exact allowed development origin.

The backend's exact hosted origin is recorded in `backEnd/supabase/functions/_shared/frontend-origins.ts`. When adding a different public hostname, update that allowlist, rerun backend tests and deploy `bye-api` before switching traffic. A wildcard CORS origin is not used. Anonymous sign-in needs no OAuth/email redirect configuration.

Sessions belong to their browser origin. A localhost session does not unlock workers.dev; the first hosted visit needs an unused invite. Single-use invites already redeemed locally cannot be reused. Local sign-out and 30-day membership expiry still apply.

Initial deployment verification and versions: [Cloudflare rollout](../../backEnd/docs/CLOUDFLARE-2026-10-31.md). Cloudflare delivers frontend assets; the measured multi-request instructor-rating queue remains a separate performance concern.


## Owner access

The private owner code can be entered in the guide’s normal invite box or on `#/owner`; it grants reusable owner access without email. Generated codes grant single-use reader access only. Roles are verified through `/me`, never a local owner flag. Owner tools generate/copy invites, list their status, revoke access and delete invites. Deleting hides the row and ends any reader access it granted; this also works for already-revoked invites. Newly generated codes are shown once and never stored locally. Lock this device clears access and RMP memory. See [owner setup and security](../../backEnd/docs/OWNER_ACCESS.md) for server configuration and verification; the actual owner code is not part of this repository.

Published PCC semesters now appear in the semester selector and load on first selection. The browser polls shared import progress while visible; previously imported terms stay available. PCC fetches share a five-minute minimum between starts across semesters, so first imports may queue. Refresh labels distinguish older data, queued work, source work and failed saved-data reads; timestamps remain actual successful source-check times.

Status polling is adaptive: unknown every 5 seconds, red every 5 minutes, yellow every 10 minutes, green every 30 minutes. The search/guide header uses the selected semester’s recorded last successful check, explicitly labelled as a semester check; course reports retain section-specific freshness. Real timestamps still age after five minutes, and a worsening state shortens a pending polling timer. Hidden/offline tabs pause and recheck on return; failures back off and respect Retry-After. This changes saved-status reads only; PCC fetch coordination and report seat-count polling remain unchanged.

The header consistently describes semester worker status on every screen. Open its details for queued/running feedback, the actual last successful semester check, this device’s observation time, and Check now. Progress is indeterminate because PCC provides no percentage. Checking status preserves loaded sections and report/review state. Independent devices may retain different snapshots between polls; Check now or returning to a visible tab rereads shared status without forcing a source fetch.

The header badge now measures the last BYE API read: green Connected to BYE after success, yellow while checking/offline, red after a failed read, grey before the first read. PCC data age and queued/running source work appear separately inside its details. Reports retain their section freshness warnings. Successful connection status reads for imported terms use the green 30-minute interval; first imports continue five-second progress reads. A stale PCC check never changes a successful API connection to red.

Class-search results are saved per device in localStorage under bye-web:course-search:v1:, keyed by school, semester and the exact case-insensitive trimmed query. Entries retain official course IDs, zeros, suffixes, titles and pagination metadata. Valid saved results return immediately, even after reload or browser restart; the app has no TTL or automatic eviction for them. Clearing recent searches or locally signing out does not delete these course results. Access must still be unlocked before the search UI uses them. Ratings, review text, availability counts and credentials are excluded. Blocked/full browser storage falls back to normal API search. These retained snapshots do not automatically pick up later catalog edits for an already cached query. Browser/user storage clearing can remove them; caching does not sync between phone and laptop.


## Wa redesign and weekly Plans — November 1, 2026

The active UI uses `wa.css`, `wa-tokens.css`, and the Wa shell components. The old reference CSS is retained for reference and is not imported by the application. The layouts were rebuilt from the supplied Wa HTML boards after the initial CSS-only implementation was rejected.

The protected `/me/plan` API stores the complete collection of school/semester Plans with revision checks. Exports read back through the import validator before download. Backups exclude availability, RMP information, credentials and education plans. Plans belong to the anonymous session; transferring to another device uses export/import.

Backend deployment: bye-api v19; additive SQL migration `20261101074049_wa_weekly_plans_and_rmp_refresh.sql`. Manual RMP refresh uses a shared per-professor cooldown (1800 seconds by default); successful profiles are reused for 90 days with retained stale fallback.

Verification: 71 frontend tests and 65 backend tests pass. The production build and deployment checks pass. Browser checks covered responsive Plan layouts at 390/768/1440, Guide, real comparison/report navigation, adding a real PCC section, server-confirmed In Plan, and verified backup creation. Live API checks covered save/readback, invalid-input denial, stale-revision rejection and preserving the prior Plan. Temporary test invites were revoked and the browser verification section was removed. Lighthouse and field Core Web Vitals were not measured.
