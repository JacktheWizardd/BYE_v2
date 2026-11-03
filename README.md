# BYE v2 — Before You Enroll

Private-access college schedule discovery and professor comparison app, currently connected to Pasadena City College.

## Project layout

- `frontEnd/bye-web`: React, TypeScript and Vite application deployed to Cloudflare Workers.
- `backEnd`: membership-protected API, PCC synchronization, RMP adapter/cache, versioned Supabase migrations and tests.
- Other `frontEnd` folders: design references and earlier prototypes; the live application is `frontEnd/bye-web`.
- `AGENTS.md`: project working guidance, including the education-plan extraction rule.

See [frontend setup](frontEnd/bye-web/README.md), [backend setup](backEnd/README.md), and [backend deployment](backEnd/DEPLOYMENT.md).

## Current state

Schedule browsing, instructor reports, invite access and owner invite management are implemented. Education-plan importing is work in progress: structured-plan validation and regression tests exist, and PDF/OCR dependencies are pinned; protected persistence is deployed to bye-dev; browser extraction and review screens are unfinished. Professor Watches and the weekly planner remain subsequent features.

RMP ratings are fetched only when someone opens a professor who isn't cached yet; BYE's server makes that request with no student data, and the shared cache then serves everyone. Entries stay fresh for six months, are kept up to a year, and source requests are capped at 200 per day. There is no background crawler. See [the RMP privacy architecture](backEnd/docs/RMP_PRIVACY_ARCHITECTURE.md).

GitHub stores source and migration history. The database remains on Supabase and the hosted frontend remains on Cloudflare. Pushing code alone does not deploy either service; automated deployment has not been configured here.

## Development

Use the commands and environment examples in each area's README. Keep backend changes in `backEnd` and application changes in `frontEnd/bye-web`.

```sh
# Backend checks
cd backEnd
node --test

# Frontend (from frontEnd/bye-web)
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

The frontend production configuration contains public project identifiers and the publishable key only. Backend credentials and session files belong in local ignored files or the hosting provider's secret settings.

Local PDFs, education-plan documents, optional preview/screenshot galleries, moodboards, exports, dependency folders, generated builds and machine-specific tooling are excluded from Git. Sanitized fixtures, required app assets and their bundled licenses are included.

Operational documentation and scripts are included with the owner’s explicit approval. Credentials, sessions and personal documents remain excluded.
