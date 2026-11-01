# Shared seat refresh and view restoration — November 1, 2026

The reader-accessible POST `/v1/schools/{school}/terms/{term}/refresh` queues availability work through `bye_request_refresh`. Pending work is reused under the existing school row lock. New requests respect the recorded next-due time; existing jobs retain FIFO order and retry deadlines. The worker still enforces the shared five-minute fetch gate. An accepted request means queued work, not a successful PCC check. Previous counts and check times remain visible through upstream failures.

The frontend polls pending worker status every five seconds while visible and rereads sections when a successful check advances. Seat updates do not refresh RMP. The shared source can still fail; retry status is displayed rather than claiming fresh counts.

View preferences live in sessionStorage under an authenticated-user-specific key. Search resumes its last report; New search is explicit. Plan semester/day, comparison controls, Owner note/filter, review filters/order, import previews and Undo are retained separately. Failed Plan drafts include their base revision and require reconciliation when the saved revision changed. Seat data, RMP review bodies, invite codes and credentials are not stored in view preferences. Lock/access loss removes the current user's view state. Browser storage failure falls back to memory.

Verification: 73 frontend tests and 67 backend tests passed, with TypeScript/build and public-bundle deployment checks. Browser verification confirmed Wednesday survives app-tab switching and reload, a professor report retains Mon/Wed filtering through a Plan round trip, and reader refresh is accepted without an owner-permission error. SQL tests cover coalescing, future deadlines and denied direct browser RPC calls. Existing tests cover polling pause/resume/backoff. Exhaustive visual checks of every restored modal/error permutation were not performed.

Deployed backend: bye-api v21. Migration: 20261101080742_request_shared_seat_refresh.sql. Backend was deployed before the frontend.

## Seat semantics correction

A subsequent direct comparison with PCC for Frank Bermudez, Fall 2026 MATH 005A, confirmed CRNs 70720 / 76615 / 77671 have enrolled counts 27/28, 27/30 and 23/28 respectively. Their raw remaining capacities are 1, 3 and 5, while all three source registration statuses are C (Closed). The redesigned card had dropped the source-status display and incorrectly inferred registration openness from positive remaining capacity. PCC's own UI displays enrolled/capacity, which also made the unlabeled remaining/capacity numbers appear numerically wrong.

Cards now explicitly label remaining capacity, separately show enrollment, and respect Closed/Waitlist/unknown registration status. Open-seat summaries include only source status O; closed and waitlisted sections cannot inflate open totals. Old check times remain visible and old status is labelled Last checked. Two regression tests cover the actual closed-with-positive-capacity case. Frontend suite: 75 passing tests.

The primary section counter and its meter now use enrolled/capacity to match PCC directly (Frank: 27/28, 27/30, 23/28). Remaining capacity is secondary text, and registration status stays independent. The section reader also advances the UI clock when new rows arrive; the freshness formatter retains valid recorded check times even if the UI clock briefly lags them. This addresses a valid per-card check time being labelled unavailable in the summary. Frontend suite: 76 passing tests.

Seat and waitlist bars now use explicit token-colored tracks rather than native browser meter styling. Enrollment is red for closed/full, green only for source-open sections, and neutral for unconfirmed registration status. Waitlists are grey when empty or unavailable, amber when partially occupied and red when full. Visual tracks are 6 px and square, with accessible meter values only when the count and capacity are known. Frontend suite: 77 passing tests.
