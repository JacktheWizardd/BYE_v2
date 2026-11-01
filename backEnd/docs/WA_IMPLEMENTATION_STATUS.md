# Wa release — November 1, 2026

The backend and revised frontend are deployed to the existing BYE site.

The first implementation reused too much of the old layout. The revised implementation replaces its active CSS, rebuilds the shared header/navigation, Guide and comparison hierarchy, uses the reference numeric tiles, and adds Plan day bars, course swatches, hatched study bars, steppers and desktop study/selected-day sidebar. Original frontend reference folders remain unchanged.

Backend: bye-api v19. Migration: `20261101074049_wa_weekly_plans_and_rmp_refresh.sql`. No historical migrations were replayed. Rollback backend source is retained at `/tmp/bye-release-rollback/bye-api-v17.json`; prior Cloudflare version is `45ea99fe-f3f7-49f8-b07f-8abd4dcf1b78`.

Verified: 71 frontend tests, 65 backend tests, TypeScript, production build and public-bundle checks. Authenticated live Plan save/readback, invalid input, stale revisions and atomic preservation passed. Browser verification covered real PCC comparison/report data, confirmed Add to Plan and backup readback. Plan viewport overflow checks passed at 390, 768 and 1440. Temporary invites were revoked and the test section was removed.

Limits: Lighthouse/field performance targets have not been measured; exhaustive automated accessibility and every illustrated state-board permutation have not been verified. Existing platform advisories remain for pg_net placement, managed Cron policies and leaked-password settings; the new server-only tables deliberately have RLS and no browser policies/grants, matching the existing application model. Education-plan import and Watches remain outside this release.
