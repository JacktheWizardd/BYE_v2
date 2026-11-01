-- Scheduler internals are not part of the browser-facing application API.
revoke all on all tables in schema cron from public,anon,authenticated;
revoke all on schema cron from public,anon,authenticated;
revoke execute on all functions in schema net from public,anon,authenticated;
