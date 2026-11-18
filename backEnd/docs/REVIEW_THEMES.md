# Both sides and review themes

Added November 17, 2026. A headline rating is a lifetime average across every course a
professor has taught. The professor report now shows what that average hides.

## What the reader sees

The `Both sides` panel sits above `Original reviews` in the professor report and follows the
same course filter.

- **Counted in the browser, no AI:** average of the loaded reviews, average of the last 24
  months (needs three ratings), and the lifetime rating side by side; a notice when the
  recent average is 0.7 or more away from the lifetime one; critical (rated 1–2) and positive
  (rated 4–5) columns with counts, grades reported, tags chosen, would-retake answers and the
  three most recent reviews of each side as written.
- **On request, AI-written:** `Summarise repeated points` lists up to four points each for
  what critics repeat, what critics still credit, and what fans repeat. Each point opens to
  the reviews behind it. The block is labelled as AI, with the model, date and review counts.

The counts cover the loaded reviews only, and the panel says so when more exist.

## Review fields

Each review now also carries `grade`, `would_take_again` (true, false or null) and `tags`,
from RMP's `grade`, `wouldTakeAgain` and `ratingTags`. Unknown values stay null or empty.
Review cache keys gained a version (`REVIEWS_VERSION` in `src/rmp.js`), so each professor is
refetched once the next time someone opens them. Expect a short rise in RMP requests, inside
the existing daily cap.

## Themes route

`POST /v1/schools/{school}/instructors/{uuid}/rmp/themes` with optional `profile_id` and
`filter`. Membership is checked like every RMP route. GET is not accepted.

1. Reads the same cached review pages a reader would load for that filter: 20 per page, at
   most five pages. Uncached pages are fetched from RMP under the normal limits.
2. Fewer than five written reviews returns `state: "insufficient"` with counts and stops.
3. Otherwise looks up the themes cache entry for that exact set of reviews. A hit returns
   with no model call.
4. On a miss it calls `bye_ai('acquire')`, then the model once, validates the reply and
   caches it.

Responses: `ready` (with `basis`, `critics`, `conceded`, `fans`, `model`), `insufficient`,
or an error: `themes_not_configured` (no key), `themes_disabled`, `themes_limited` (429),
`themes_unavailable` (model failed or replied with something unusable; never cached).

## What is trusted and what is checked

Review text is untrusted input and the model's reply is untrusted output.

- The prompt tells the model the reviews are data and to ignore instructions inside them.
- A point is kept only if it cites at least two reviews that exist in the set and sit on the
  right side (critics: rated 1–2; conceded: rated 1–3; fans: rated 4–5). Other points are
  dropped, as are points over 200 characters or containing links or markup.
- The frontend renders points and reviews as inert text.

A point can still be a poor reading of the reviews it cites. That is why each one links to
its evidence and the block says it can be wrong.

## Privacy boundary

The model request is a fixed HTTPS POST to `https://api.anthropic.com/v1/messages` with
three headers (`content-type`, `x-api-key`, `anthropic-version`) and, per review: a
positional key, rating, difficulty, month, course label, grade, tags and up to 700 characters
of text. It never includes reader identity, sessions, cookies, IPs, BYE or RMP identifiers,
or the instructor's name (unless a reviewer wrote it in their comment).

The provider sees BYE's server IP, the review text and the timing. Timing follows reader
activity, as with RMP, but does not identify a reader.

## Cost and switches

- **Off by default:** without the `BYE_AI_KEY` function secret nothing is sent anywhere.
  `BYE_AI_MODEL` optionally overrides the default model (`claude-haiku-5-5`).
- **One call per review set:** the cache key includes a fingerprint of the review IDs, so a
  summary is regenerated only when the reviews for that filter change.
- **Daily cap:** `bye_rmp_settings.ai_daily_cap` (default 40 model calls per Pacific day).
  `bye_ai_usage` holds counts only.
- **Kill switch:** `update public.bye_rmp_settings set ai_enabled=false where id;`
  Turning RMP off (`enabled=false`) also stops themes.
- **Retention:** theme entries live in `bye_rmp_cache` under keys containing `"reviews"`, so
  the existing one-year eviction and size caps apply to them.

## Deploying

1. Apply migration `20261118090000_review_themes.sql`.
2. Optional: `supabase secrets set BYE_AI_KEY=...` (and `BYE_AI_MODEL`).
3. Deploy `bye-api`, then the frontend.

Without step 2 the panel still works; only the AI block reports that it is not set up.

## Verification

Backend tests (`test/themes.test.js`) cover the new review fields, counting, citation and
side validation, caching, failure and no-key paths, the model request's contents, POST-only
routing and the SQL cap and switches under PGlite. Frontend tests cover the counting, date
parsing, the panel markup, inert rendering and the AI labelling. The model call itself has
not been exercised against the live provider.
