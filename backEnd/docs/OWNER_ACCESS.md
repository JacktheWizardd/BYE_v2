# Owner access and generated reader invites

The private numeric owner code works in the ordinary guide invite box and on `#/owner`. No email/password account is required. The value is configured server-side and is never embedded in source, migrations, frontend assets, public environment configuration or logs.

## Access rules

- The browser reuses its Supabase anonymous identity or creates one, then calls the existing invite-redemption endpoint. The API verifies Auth, HMAC-hashes the submitted code with the private project pepper, and performs the access change in Postgres.
- `bye_owner_credentials` contains only a singleton HMAC hash and update timestamp. It has RLS, no browser table privileges and no browser-callable credential RPC. The service-role-only wrapper around `bye_control` checks the owner hash before delegating ordinary invites/jobs to the established implementation.
- The owner code is reusable. Each successful owner unlock grants or renews 30 days of owner membership on that anonymous identity, without consuming a reader invite. An already signed-in reader can upgrade using the owner code; its membership is then independent of the old reader invite.
- Generated codes are single-use reader invites with 30-day access. New generated codes always include a letter, keeping them distinct from numeric owner codes. Configuring an owner hash that matches any existing invite is rejected.
- Owner and reader redemption share the existing persisted limit: three failed attempts per minute per user and gateway-provided IP actor. Locks serialize concurrent redemptions. A valid code cannot bypass an active lockout. API responses expose Retry-After, not guessed attempts remaining.
- `/me` supplies the trusted membership role. UI storage flags, request metadata and a `role` field in the request do not grant owner access. Every API operation still checks the current unexpired, unrevoked membership; every admin operation also checks role.
- Lock this device uses local Supabase sign-out and clears frontend access/RMP state. Owner access can be recovered with the reusable code. Owner sessions do not carry database/service-role credentials.

## Owner tools

Owners can generate an invite with an optional note, copy the new code, list the latest 100 non-deleted invites, revoke access, and delete any invite. A generated code is displayed once and retained only in component memory while that screen is open. Lists contain no codes or hashes. Revoking a redeemed invite also ends the reader membership it issued. Broader source/import administration remains outside this UI.

A normal reader who visits `#/owner` sees the owner sign-in form, never the invite controls. Sign-in preserves a saved search/report destination; otherwise owners land on the owner screen and readers on search. The footer links to Owner tools after the role is verified.

## Trusted setup and rotation

`POST /v1/admin/owner-code` is owner-only and accepts `{code}` with eight numeric digits, optionally separated with a hyphen. The API stores only the computed HMAC hash. The database independently verifies the configuring membership is an active owner.

From a trusted server shell, configure `BYE_OWNER_CODE` privately and run:

```sh
node backEnd/scripts/set-owner-code.js
```

The command uses the existing private `backEnd/.owner-session.json`, refreshes it if necessary and prints only success/failure. Do not paste that session into the frontend. Clear the temporary environment value after configuration. A trusted project administrator can recover an expired bootstrap owner as before.

Rotating the owner code prevents future use of the old code; it does not revoke existing memberships. Existing memberships can be revoked through trusted administration. Pepper rotation invalidates the owner-code hash as well as unused invite hashes, so configure a new owner hash after any pepper rotation. Never include the actual owner code in documentation or migrations.

## Verification — 2026-10-31

- Migration `20261031212820_owner_access_code`; Supabase bye-api v13; Cloudflare version `aa675041-fbfe-47ba-8f37-a3a2aec62971`.
- 44 backend and 47 frontend tests pass; TypeScript, production build and deployment asset checks pass.
- Database tests cover reusable owner unlocks, independent devices, reader-only codes, simultaneous single-use reader redemption, reader-to-owner upgrade, membership expiry/renewal, shared user/IP lockout, hash-conflict rejection and denied browser table/RPC access. Preview scheduling/publication still traverses the wrapper correctly.
- Live hosted verification covers owner unlock through the guide, preserved report return, owner-code sign-in on the dedicated page, invite creation/copy UI, normal reader unlock, hidden owner controls for readers, owner session restoration and revocation of a disposable reader. The revoked reader receives 403 from `/me`.
- A live reader receives 403 for owner invite/code routes, the owner credential table and both control RPCs through the Data API. No credential hashes were retrieved by these checks.
- 390/768/1440 layouts have no horizontal overflow; owner buttons are at least 44px high. Keyboard Tab from Note reaches Generate invite. Browser error logs were empty. Screenshots/JSON under `exports/owner` contain no owner code or usable generated test codes.
- All disposable reader invites were revoked and their private test session files removed. The user’s owner session is left signed in on the hosted app. No existing normal-user membership was changed.
- Ordinary Cron availability jobs succeeded after deployment at 21:30 and 21:36 UTC; no PCC import was forced for this feature.
- Existing platform advisor warnings are unchanged. The additional RLS/no-policy INFO notice is deliberate for the backend-only credential table; no browser policies were added.


## Invite deletion — 2026-10-31

Every invite row has Delete, including revoked rows. `POST /v1/admin/invites/:id/delete` requires an active owner membership. The backend passes the verified Auth user ID to a service-role-only `bye_delete_invite` RPC, which checks owner access again, locks the invite row, sets its `deleted_at` and `revoked_at`, and revokes any reader membership linked to that invite in the same transaction. The list endpoint filters `deleted_at=is.null`. Deletion is idempotent. Concurrent redemption either finishes first and is then revoked, or sees the revoked invite and fails. Independent owner access is unaffected.

This is a soft deletion: the audit record/hash stays backend-only so a deleted code cannot become valid again. The row disappears from the owner list. The new-code output is cleared when its invite is deleted, failures preserve the list, and focus returns to Reload invites after deletion.

Migration `20261031214503_delete_invites`, bye-api v14, Cloudflare version `272c689d-1940-41d2-9056-27c385fee942`. Verification: 46 backend + 48 frontend tests, TypeScript and production build pass. Local database tests cover unused/redeemed/revoked deletion, concurrent redemption, expiry, owner isolation, idempotency and denied browser RPC access. Live UI deletion of redeemed and revoked disposable records survives reload; the deleted reader receives 403 from `/me`, reusing its code returns 400, and reader API/direct Data API delete attempts return 403. No existing user invites were deleted during testing.
