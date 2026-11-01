# Cloudflare frontend rollout — 2026-10-31

Frontend: https://bye-web-v2.jack-truong2k1.workers.dev

- New static-assets Worker `bye-web-v2`; checked that it did not already exist before publishing. Existing/v1 deployments were not changed.
- Cloudflare version: `4ac9a7f4-df37-4d7b-a018-81dfc01dfc7f`, Wrangler 4.156.0, compatibility date 2026-10-31.
- Published normal production frontend `index-BCdoFy64.js`, 480.38 KB / 139.17 KB gzip. No benchmark build, owner session or backend secret is included.
- Supabase `bye-api` version **12** adds exact-origin CORS for the hosted URL and retains localhost:5173. `Vary: Origin` is included. Unlisted origins/preview subdomains receive no allow-origin response. Auth/membership checks remain enforced; no migration or source-refresh change.
- HTML HTTP 200, `public, max-age=0, must-revalidate`; hashed script HTTP 200 with one-year immutable browser caching. CSP limits app connections to the existing Supabase project, and the static app is noindex.
- Verified real hosted anonymous-auth/invite redemption and return to the requested search screen, shorthand `MATH5A` search, neutral 34-section/26-instructor comparison, instructor report, Copy CRN confirmation and deep-link/session restoration after reload. No browser errors were captured in this smoke check.
- Used a disposable reader invite for verification; revoked its membership and removed its private invite file afterward. No owner session entered the browser.
- **41 backend tests + 41 frontend tests passed**, TypeScript/production build passed, Cloudflare dry-run and deployment asset checks passed.
- CORS and cache header checks are saved in `exports/cloudflare/http-checks.json`; the hosted report screenshot is saved alongside it. This was a smoke test, not a new five-run performance benchmark.
- Cloudflare hosts only the frontend. Supabase remains the Auth/database/API host, and the two-request instructor queue and complete comparison ordering behavior are unchanged. Do not claim the previous 3.94-second comparison median has been eliminated by hosting.

Use `pnpm run deploy:cloudflare` from `frontEnd/bye-web` for updates. It builds and checks the bundle first. Preview locally on localhost:5173 after stopping Vite; other preview origins are not trusted. For a rollback, use `pnpm exec wrangler rollback --help` to inspect current CLI options and select a verified existing version. There was no pre-existing v2 version before this deployment.

The hosted origin has separate browser storage, so users need an unused invite on their first hosted visit. Existing localhost sessions and already-used invite codes are not transferable. No custom domain, paid-resource change or additional API hosting layer was configured.
