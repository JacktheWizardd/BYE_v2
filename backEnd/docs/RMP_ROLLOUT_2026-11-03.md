# BYE RMP rollout — November 3, 2026

## Applied and verified

- Applied `rmp_background_privacy` database migration.
- Deployed `bye-api` v27. Read-back confirms cache-only student reads and an exact match to the prepared source. All previously deployed modules remain present, including live-only watches and education modules.
- Deployed `bye-rmp` v1 with existing cron-secret authentication.
- Installed `bye-rmp-background` on `*/5 * * * *`: one catalog instructor job every five minutes, with the existing distributed limits and Retry-After handling. No manual source refresh was triggered for verification. Scheduled production retrieval may now contact RMP as intended.
- Prepared source passed 19 focused tests with simulated RMP responses. Frontend production build and deployment asset checks passed.

## Pending

Cloudflare frontend publication failed before upload because the session could not resolve its API host. The expanded-access retry was automatically rejected by session policy. The current public frontend can continue using supported GET routes against v27, so the backend privacy change is active independently of the new frontend label and POST-read behavior.

The verified build remains at `work/BYE_v2/frontEnd/bye-web/dist`. From that frontend directory, the final publishing command is:

```powershell
pnpm exec wrangler deploy --keep-vars --message "Activate RMP privacy frontend after backend v27" --no-autoconfig
```

Successful scheduled source retrieval, authenticated browser behavior and the final Cloudflare bundle still require verification. Deployment status and source read-back alone do not establish end-to-end runtime success.

## Source preservation

The deployment package was prepared from the complete live v26 function, then patched only for RMP isolation and POST compatibility. This follow-up commit preserves those backend modules in the repository, including the live-only watches and education helpers. No live secret values were retrieved or changed. See `MAC_FRONTEND_DEPLOY.md` to finish frontend publication from the Mac.
