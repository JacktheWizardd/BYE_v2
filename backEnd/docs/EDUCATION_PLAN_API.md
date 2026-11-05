# Education-plan persistence API

Status: backend persistence is deployed to bye-dev (`bye-api` version 17). The browser local-PDF import/review flow lives at `#/education-plan` in `frontEnd/bye-web` and is separate from the weekly planner preview at `#/plan`.

GET `/v1/me/education-plan` returns `{data: null}` or `{data: {revision, updated_at, plan}}`.
POST accepts `{expected_revision, plan}`; revision 0 creates the first plan. A stale revision returns 409 without changing stored data. The backend validates the plan, recalculates totals and uses the verified Auth user ID.

Only this endpoint accepts up to 1 MiB of structured JSON. Other API body limits remain 8 KiB. The database RPC rechecks and locks membership before reading or saving. Browser roles have no table or RPC privileges; RLS is enabled. The table stores no original document bytes.

## Browser importer (local PDF)

- PDFs are read in the browser with same-origin PDF.js / Tesseract workers under `/assets/ocr`.
- Extraction reconstructs terms from headings and keeps continuation-page courses on the open term until a new heading appears.
- Users must review every term and entry before save. Alternatives, mismatched totals and manual rows require explicit notes.
- JSON export/import moves structured drafts only; imported JSON is marked unreviewed.
- CSP allows `'wasm-unsafe-eval'` and `worker-src 'self'` for local OCR/PDF workers; CDN workers are not used.

Verification: local API tests cover spoofed owners, rejected/unreviewed payloads, limits, conflicts and access loss. PGlite tests cover compare-and-swap, per-user isolation and database grants. Frontend reconstruction fixtures cover PCC continuation (**COUN 010 → Fall 2026**, **MATH 022 → Spring 2027**, **MATH 010 → Spring 2028**). A deployed rollback-only fictional check confirmed revoked membership is denied; browser table and RPC grants were also checked directly. No real education plan was uploaded.

Pending: broader multi-school layout fixtures, mobile browser hardening, Cloudflare frontend rollout of this branch, and end-to-end save/reload against bye-dev from a reviewed fixture.
