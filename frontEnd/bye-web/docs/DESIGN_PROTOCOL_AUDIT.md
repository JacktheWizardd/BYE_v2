# BYE design protocol audit — November 1, 2026

Source: supplied BYE_HANDOFF.md, bye-tokens.css and bye-reference-html.zip. Documents and sample board data are design references; user requests determine behavior. Reference folders are unchanged.

## Why isolated fixes missed issues

The same visual meanings were implemented in separate components, Owner still used a native meter, and several later CSS selectors overrode global target/font rules. Desktop click checks did not exercise the mobile path that can omit a synthetic click. This pass moves semantic colors into `src/design.ts`, makes the active stylesheet readable, uses the shared custom meter, and adds direct pointer-handler regression coverage.

## Explicit current owner overrides

- Enrollment displays enrolled/capacity, with remaining seats separately; the original board displayed seats-open/capacity. This follows the prior seat-count correction.
- At 90% enrollment, the bar is red and says “Nearly full · Seats open” if PCC registration is open. 90% was the implementation threshold chosen after the owner requested red for 29/30. It is **not** a threshold specified by the original handoff. Closed/full remains red; unknown remains grey. PCC registration status is never inferred from color.
- Mobile/touch form controls use at least 16px to prevent iOS focus zoom. Pinch zoom remains enabled.
- Plan always offers its own semester picker, including semesters with no saved Plan; Search retains its own semester and class. The first Plan visit starts with the Search semester, then remembers its independent choice per school/user/browser tab.

## Corrections in this pass

- Schibsted Grotesk and JetBrains Mono explicitly declare their variable weight ranges and font-display; Japanese uses the supplied self-hosted Zen Kaku Gothic New weights.
- Real `lang="ja"` heading elements replace generated Japanese text in Report and Owner. Plan dashboard labels and Add to Plan text gain language markup.
- Minimum button/select/summary targets, Clear buttons, peek control, stepper buttons and footer links meet 44px; desktop edit-search and original-RMP links gain larger targets.
- Watches has a visible English “Coming soon” label and remains disabled. Header seal is rotated; mobile navigation accounts for the safe area.
- Unconfirmed instructor rows use dashed borders; reviews and definition rows use zebra backgrounds. Top BYE badges remain absent.
- Seat/waitlist/Owner access bars share custom square meters and semantic colors. Revoked access shows zero days/red; ending access is amber; Owner status tags reflect expiry.
- Plan has explicit async dashed/unknown dotted swatches, red conflict badges, token-based course colors and compact desktop timeline labels. Full meeting titles remain available; selected-day sidebar contains details.
- RMP unavailable values render aligned dash tiles. Refresh retains/dims prior tiles. Older checks are amber. Review ordering explicitly applies to loaded reviews.
- Empty results offer Edit search and Try any day.
- Course suggestions select on completed pointer release without requiring a synthetic click. Dragging/cancellation does not select. Mouse hover updates the active option; keyboard scrolling is independent of mouse movement.
- Plan semester selection is always visible, uses term names, and is independent of Search. Each semester retains its selected day.

## Verification completed

| Surface | 390 | 768 | 1440 | Method |
| --- | --- | --- | --- | --- |
| Guide | pass | pass | pass | Live-data DOM/layout, representative screenshot compared to Guide board |
| Search | pass | pass | pass | Live-data DOM/layout, ENGL C1001 keyboard selection |
| Results | pass | pass | pass | Live PCC rows, skeletons, layout/targets |
| Report | pass | pass | pass | Live PCC report, aligned tiles, red 29/30 bar, layout/targets |
| Plan empty | pass | pass | pass | Authenticated app, semester/day navigation and reload |
| Plan populated/conflicting/async/unknown | pass | pass | pass | Read-only deterministic fixtures, layout/targets, representative desktop screenshot |
| Plan failed draft | pass | pass | pass | Read-only fixture, retained contents and unsaved label |
| Owner sign in | pass | pass | pass | Live app, no privileged controls |
| Owner empty tools | pass | pass | pass | Read-only owner fixture, layout/targets; no credentials or invites created |
| Unlock entry/checking/wrong/locked | pass | pass | pass | Read-only CodeInput fixtures, no navigation |
| Seat/waitlist open/near-full/full/unknown | pass | pass | pass | Read-only meter fixtures plus regression tests |

No horizontal overflow or sub-44px enabled buttons/selects/summaries in these final checks. Actual `innerWidth` was checked, rather than trusting the viewport command. Plan → Fall 2026/Wednesday → Search returned to the Winter 2027 MATH 005B report; returning to Plan retained Fall/Wednesday, including reload. ENGL C1001 keyboard selection stored the complete class identity and title.

88 frontend tests and the TypeScript/production build pass. Initial JavaScript is approximately 153.5 KB gzip, below the 180 KB target. Reduced-motion CSS disables animations/transitions. Runtime implementation remains in frontEnd/bye-web; no backend/schema changes were needed.

## Limits of this audit

This is a source, component, responsive DOM and representative screenshot audit, not a pixel-diff certification of every possible live-data/state permutation. Real-device iPhone Safari keyboard/touch behavior needs a device smoke test; tests cover the missing-click path directly but cannot certify a physical phone. Live owner mutations, actual network-failure timing, and every backup/import/cooldown permutation were not re-created in this pass; existing tests remain. Lighthouse accessibility/performance and field LCP/INP/CLS were not measured, so their targets are not reported as passed. Large Japanese font assets remain a performance optimization opportunity. Watches and education-plan import remain out of scope.

Reproduce deterministic visual fixtures with `node scripts/design-audit-fixtures.mjs` from frontEnd/bye-web (Vite must be installed). Output goes to /tmp/bye-design-audit, outside production assets; serve it locally alongside Vite on port 5173. The script performs no authentication or API writes.
