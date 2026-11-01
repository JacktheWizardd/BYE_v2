# Education-plan persistence API

Status: backend persistence deployed to bye-dev (`bye-api` version 17). The browser reader/import/review flow is not implemented yet. This is not a completed importer release.

GET `/v1/me/education-plan` returns `{data: null}` or `{data: {revision, updated_at, plan}}`.
POST accepts `{expected_revision, plan}`; revision 0 creates the first plan. A stale revision returns 409 without changing stored data. The backend validates the plan, recalculates totals and uses the verified Auth user ID.

Only this endpoint accepts up to 1 MiB of structured JSON. Other API body limits remain 8 KiB. The database RPC rechecks and locks membership before reading or saving. Browser roles have no table or RPC privileges; RLS is enabled. The table stores no original document bytes.

Verification: local API tests cover spoofed owners, rejected/unreviewed payloads, limits, conflicts and access loss. PGlite tests cover compare-and-swap, per-user isolation and database grants. A deployed rollback-only fictional check confirmed revoked membership is denied; browser table and RPC grants were also checked directly. No real education plan was uploaded.

Pending: expanded provenance model, PDF/OCR workers and same-origin assets, structure parsing, editable source review, JSON export/import UI, browser and mobile testing, deployed end-to-end save/reload, Cloudflare rollout.
