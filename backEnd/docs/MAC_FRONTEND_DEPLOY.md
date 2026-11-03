# Finish the BYE frontend deployment on Mac

The backend privacy rollout is already deployed: `bye-api` v27 and `bye-rmp` v1.
The scheduling migration is installed and `bye-rmp-background` runs every five
minutes. Do not reapply the migration or manually trigger RMP to finish this work.

This commit also preserves the modules previously present only in the live backend.

After pulling `main`, run from the repository root:

```sh
cd frontEnd/bye-web
pnpm install --frozen-lockfile
test -f .env.local || cp .env.example .env.local
pnpm run build
pnpm run check:deployment
pnpm exec wrangler deploy --keep-vars --message "Activate RMP privacy frontend after backend v27" --no-autoconfig
pnpm exec wrangler deployments list --name bye-web-v2 --json
```

Use your existing Cloudflare login; complete login if Wrangler requests it. Keep
`VITE_BENCHMARK` disabled. The template configuration contains public frontend
values only. Existing `.env.local` is preserved; verify it targets the project in
`.env.example` if the deployment check fails.

Expected public site: https://bye-web-v2.jack-truong2k1.workers.dev

Verify the upload succeeds and the latest Cloudflare deployment timestamp changes.
Refresh the site and verify the RMP button reads **Reload cached RMP**. Use normal
cache-only browsing; do not run `scripts/benchmark/source.mjs` or a source load test.
No additional Supabase deployment is needed just to publish this frontend.
