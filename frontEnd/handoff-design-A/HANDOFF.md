# BYE — Design A ("Spellbook") frontend handoff

BYE (Before You Enroll) lets a small, invite-only group of PCC students look up a class and compare every section's professor using Rate My Professors (RMP) ratings. This package is the visual and interaction spec for the frontend. Build it in **React Native with Expo**, targeting **web first** (via react-native-web), with iOS/Android later from the same code.

Everything here is mocked. Nothing talks to a server.

---

## 1. What's in this folder

| Path | What it is |
|---|---|
| `design.html` | Runnable mockup of every screen and state. Source of truth for layout, spacing, colors and copy. |
| `theme.ts` | Design tokens (colors, type, spacing, radii, breakpoints) ready to import in Expo. |
| `screenshots/` | `desktop-*.png` at 1440 px wide, `mobile-*.png` at 390 px wide (2× pixel density), full page. Numbered by screen/state. |
| `assets/fonts/` | Libre Baskerville (regular + italic), Schibsted Grotesk, JetBrains Mono. All variable TTFs, SIL Open Font License (OFL files included). |
| `assets/icons/` | Stroke icons as SVG: `sparkle`, `search`, `arrow-left`, `arrow-right`, `copy`, `external`, `check`, `alert`, `close`. Use with `react-native-svg` (or `react-native-svg-transformer`). |

**External dependencies:** none at runtime. The mockup uses only local fonts and inline SVG. For the app: `expo-font`, `react-native-svg`, `expo-clipboard`, `expo-router` (suggested), `@react-native-async-storage/async-storage`.

## 2. How to preview

1. Open `design.html` in Chrome, Safari or Firefox (double-click works; no server needed).
2. Use the dark **Mockup ▾** button in the bottom-right corner to jump to any screen or state. It is a design tool only — do not build it.
3. Resize the window: below 1024 px you get the phone layout, at 1024 px and up the desktop layout.
4. The working demo invite code is **`WIZD-2026`**. Any other 8-character code fails; 3 failures locks the form for 60 s.
5. Add `?shots=1` to the URL to hide the mockup panel (used for the screenshots).

## 3. Screens

| # | Route (suggested Expo Router path) | Screen | Screenshots |
|---|---|---|---|
| 1 | `/` | **Landing + invite code** — personal intro from TheWizardd, invite form, "What's in the spellbook" | 01–04, 17 |
| 2 | `/search` | **Search** — class combobox with suggestions, semester, free-days filter, quick "Try" chips | 05–08, 19 |
| 3 | `/professors` | **Professors** — everyone teaching the class, ranked, with sort; on desktop also shows the report for the selected professor | 09–11 |
| 4 | `/report/[id]` | **Professor report** — scores, sections with seats, student reviews | 12–13 |
| 5 | `/choose/[id]` | **Choose RMP profile** — when a name matches more than one RMP profile | 14 |
| 6 | `/admin` | **Invite codes** (owner only) — generate, copy, revoke | 15–16, 18 |

Signed-out users only ever see `/`. Every other route redirects to `/` without a valid session.

## 4. Visual system

### Colors (`theme.ts → colors`)

| Token | Hex | Use |
|---|---|---|
| paper | `#faf8f3` | App background |
| paper2 | `#f2eee6` | Sunken panels (stats, section cards), hover background |
| card | `#ffffff` | Cards, inputs, secondary buttons |
| tile | `#eae5db` | Format tags (IN PERSON, ONLINE) |
| ink | `#161618` | Text, primary button, selected pills/days, seat bars |
| ink2 | `#6b665e` | Secondary text, help text, roman numerals |
| line | `#e2dcd0` | Hairlines and row dividers |
| lineStrong | `#8c857a` | Input + secondary button borders |
| highlight | `#f2c14e` | Highlighter under key words, rating bars, focus glow on inputs, primary hover |
| signal | `#b8401a` | Errors, "Full" waitlist text, Revoke, the sparkle accent |
| good | `#2f6b46` | Success / "used" status |

All text pairs meet WCAG AA (4.5:1). Never put `highlight` text on `paper` — highlight is only ever a background.

### Type (`theme.ts → type`)

- **Libre Baskerville** (display serif): headings, professor names, scores. Italic for roman numerals (i., ii., iii.), the "A small spell…" kicker, the "— TheWizardd" signature and footnotes. This italic serif is the main personality of Design A.
- **Schibsted Grotesk** (sans): body, labels, buttons, help text.
- **JetBrains Mono**: course codes (MATH 5A), CRNs, invite codes.
- Body is 16/24. Never go below 12 px (only the eyebrow and status badges are that small).

| Style | Phone | Desktop (≥1024) |
|---|---|---|
| Landing hero | 40/44, −1 tracking | 64/68, −1.8 tracking |
| Page title (h1) | 32/36 | 32/36 (report name 44/48) |
| Section heading | 22–24 | same |
| Professor name in list | 19/24 | same |
| Score in list | italic 34 | same |

### Spacing, radius, elevation

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64. Page gutter is 20.
- Radius: 6 (chips, day buttons), 10 (inputs, suggestion menu), 16 (cards, section panels), 999 (buttons, pills, toast).
- Shadows: `card` on the invite card and selected cards; `pop` on the suggestion menu and toast only. Everything else is flat with hairlines.

### Signature details (don't drop these)

1. **Wordmark**: "BYE" in bold Baskerville with a yellow highlighter bar behind the lower half, followed by italic "by TheWizardd".
2. **Highlighter mark**: one key phrase per page gets the yellow underline-highlight ("guessing", "professor.").
3. **Sparkle** (4-point star, `signal` red) as the only decorative icon.
4. **Roman-numeral rankings** in the professor list.
5. **Footnote line** in italic serif under lists ("Ratings are students' opinions, not a promise. Choose wisely.").

## 5. Responsive behavior

| Width | Behavior |
|---|---|
| < 1024 (phone / tablet) | Single column. Landing: hero → invite card → spellbook list. Professors and report are separate screens: tapping a row pushes `/report/[id]`; the back arrow returns to the list. |
| ≥ 1024 (desktop web) | Content max width 1200, centered. Landing: hero left (≈55%), invite card right, spellbook as 3 columns below. Professors uses a **split view**: list pane fixed at 400 px (sticky under the header) + report pane on the right. Selecting a professor updates the right pane and the URL, without leaving the page. Default selection is the top-ranked professor. |
| Forms | Search and Choose profile cap at 560 px wide; Admin at 760 px. |

Horizontal-scroll rows (sort pills, review filters) scroll sideways on phones and wrap on desktop. No page ever scrolls horizontally.

## 6. Components

| Component | Notes |
|---|---|
| `Header` | Wordmark left. Signed out: "Have a code?" ghost link that scrolls to the invite card. Signed in: nav links **Search** and **Invites** (Invites only for the owner account). Current page is ink, others ink2. Sticky. |
| `DemoBanner` | Black strip "Demo · sample data". Mockup only — remove in production, or show only in a beta/dev build. |
| `Button` | Variants: `primary` (ink bg, paper text), `secondary` (white, lineStrong border), `ghost`, `danger` (signal border/text). Min height 48 (54 for full-width "block" buttons), pill radius. |
| `TextInput` | 52 min height, radius 10, lineStrong border. Variants: default, `code` (mono 22, letter-spacing 5, uppercase), `error`. |
| `Combobox` | Class field + suggestion list (max 6 items, course code in mono + title). |
| `DayToggle` | 7 equal toggle buttons M T W Th F Sa Su, `aria-pressed`. |
| `Pill` | Toggle chip for sorts and review filters. |
| `Chip` | Mono code chip (MATH 5A, CRN 40213). |
| `Tag` | Uppercase small label (IN PERSON, FULL TERM). |
| `ProfessorRow` | Roman numeral, name, two meta lines, score on the right. Variants: rated, loading, choose-profile, can't-retrieve, TBA (not tappable). |
| `StatTile` | Big number + label + bar (rating, difficulty, would take again). |
| `SectionCard` | Tags, meeting time, room/dates/units, seats block (big number, bar, waitlist). The "full" variant turns the waitlist line signal red. |
| `ReviewCard` | Course chip + date, review text, rating/difficulty + "Source ↗" link. |
| `RadioCard` | Choose-profile option. Selected = ink border + inset ring. |
| `CodeRow` | Invite code (mono) + status badge + who/when + Copy/Revoke. |
| `StatusBadge` | `unused` (yellow tint), `used` (green tint), `revoked` (grey, strikethrough). |
| `Toast` | Dark pill, bottom center, check icon, auto-hides after 2.6 s, announced politely to screen readers. |
| `EmptyState` | Centered icon + serif title + one sentence + one action. |

## 7. Interactions, per screen

### 7.1 Landing + invite (`/`)

- **Code input** auto-formats as you type: uppercase, strips anything that isn't A–Z/0–9, inserts the dash after 4 characters, max `XXXX-XXXX`. Typing again clears an error state.
- **Unlock BYE** (submit; Enter works too):
  - Fewer than 8 characters → inline error, no request.
  - Otherwise → **verifying** state: button disabled with spinning sparkle and "Checking code…", input read-only (screenshot 02).
  - Valid → toast "Welcome in. Code accepted." → go to `/search`. Store the session token. **This screen is never shown again** to a signed-in user; `/` redirects to `/search`.
  - Invalid → **error** state: red input border, message "That code didn't work. Check it with whoever sent it. N tries left." (03).
  - 3 failures → **locked** for 60 s: input and button disabled, live countdown (04). The real limit must be enforced by the server (see §9); the UI just mirrors it.
- **Have a code?** in the header scrolls to and focuses the invite input.

### 7.2 Search (`/search`)

- **Class combobox**: suggestions appear after the first character, matching course code *or* title, case-insensitive (06). ↑/↓ moves the highlight, Enter picks, Esc closes, tapping an item picks it. Picking fills the input with "MATH 5A · Calculus I". If nothing matches: one disabled row "No PCC class matches "…". Try the code, like MATH 5A." (07).
- **Semester** select: the terms PCC has published, newest first; default is the upcoming term.
- **Days you're free** (optional): toggles. Online/asynchronous sections always show regardless of days.
- **Find professors**: if no class is chosen, shows "Pick a class first, like MATH 5A." under the field (08). Otherwise goes to `/professors` with course, term and days in the URL (so it can be shared and survives refresh).
- **Try chips** jump straight to results for that class.
- Remember the last search (AsyncStorage) and prefill it next visit.

### 7.3 Professors (`/professors`)

- **Loading** (09): the section list from PCC arrives first. Rows render immediately with the name and section info. Each professor's rating then loads one by one: show "Checking…" plus a shimmer placeholder per row, and a slim progress bar "Checking RMP… 2 of 5" under the header. When all finish, the progress bar disappears.
- **Loaded** (10): ranked list. Sort pills: **Best rated** (rating desc, default), **Easiest** (difficulty asc), **Most ratings** (count desc). Rated professors are sorted; special rows (choose / can't retrieve / TBA) always sit at the bottom in that order. Roman numerals follow the current order.
- Row variants:
  - **Rated** → tap opens report.
  - **Two RMP profiles match** → "Choose →" opens `/choose/[id]`.
  - **Can't get RMP ratings** → red text "Can't get RMP ratings. Open to retry."; tap opens the report in its error state.
  - **Instructor to be announced** → greyed out, not tappable.
- **Hover** (web): row background paper2 and the name gets a thick yellow underline. **Selected** (desktop split): white background, 1.5 px ink ring.
- **Empty** (11): no section meets on the chosen days → "No sections on your days" + "Change days" (back to search with the filter kept).
- Header context bar: back arrow (to search), course chip + title, "Fall 2026 · free M, W", and **Edit** (back to search, fields prefilled).

### 7.4 Professor report (`/report/[id]`)

- Header: eyebrow "Professor report", name, department · school, and "Wrong person? Change profile" (→ `/choose/[id]`).
- **Scores**: three stat tiles. The difficulty bar fills by value; the note under it says "lower difficulty means easier". "Rate My Professors ↗" opens the professor's RMP page in a new tab / in-app browser.
- **Sections**: one card per section of *this class* taught by this professor. Seats bar = open/capacity. 0 open → "Full · waitlist X of Y" in signal red.
- **Student reviews**: filter pills **This class · N** (default) and **All · N**; sort select **Newest** (default) / **Highest rating** / **Lowest rating**. Show 3, then **Show more reviews** adds 3 at a time. When none are left: "That's every review." Each card's **Source ↗** opens the review on RMP.
- **Can't retrieve** state (13): red-bordered card "We couldn't get Rate My Professors info for …", "RMP might be slow or down. Sections below are still accurate.", and a **Try again** button (shows a spinner while retrying, then either loads the report or shows the same card again). Sections still render.

### 7.5 Choose RMP profile (`/choose/[id]`)

- Radio cards, one per candidate (name · department, school · rating count · rating) plus **Neither of these** (show the professor without ratings).
- **Use this profile** saves the mapping (per user is fine for now) → toast "Profile linked to Professor D" → report. The choice is remembered so the user isn't asked again.

### 7.6 Invite codes (`/admin`, owner only)

- **Generate code**: optional "Who is it for?" note. Creates a code in `XXXX-XXXX` format from an alphabet without look-alikes (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`), adds it to the top of the list as **unused**, copies it to the clipboard, and shows the toast "Code R2LD-9VBN created and copied" (18).
- **Copy** (unused codes only) → clipboard + toast "Copied …".
- **Revoke** (unused codes only) is two-step: first tap changes the label to "Confirm revoke?", second tap revokes → status **revoked**, code struck through, toast "Code revoked". Tapping elsewhere resets the button.
- Codes are single-use: once someone signs in with one it becomes **used** and shows who/when.
- Summary line "1 unused · 2 used". Empty state (16): "No codes yet. Generate one above and send it to a friend."
- Non-owners who open `/admin` are sent to `/search`.

## 8. State checklist

| State | Where | How it looks |
|---|---|---|
| Hover (web only) | Buttons, rows, pills, inputs | Primary → yellow bg/ink text; secondary → ink border; row → paper2 bg + yellow underline on the name |
| Focus (keyboard) | Everything interactive | 2 px ink outline, 2 px offset. Inputs additionally get a 4 px yellow glow (17) |
| Pressed | Primary button | Moves down 1 px |
| Selected | Day toggles, pills, radio cards, split-view row | Ink fill with paper text, or ink ring |
| Disabled | Buttons | Paper2 background, dashed border, ink2 text |
| Loading | Unlock, Try again, ratings | Spinning sparkle + verb ("Checking…"), shimmer placeholders, progress bar |
| Empty | Professors (no days match), Admin (no codes), reviews ("That's every review.") | Serif title + one-line explanation + one action |
| Error | Invite code, missing class, no class match, RMP failure | Signal-red text with alert icon next to the cause; input border turns red; `aria-invalid` + `aria-describedby` |
| Success | Code accepted, profile linked, code created/copied/revoked | Toast, bottom center, 2.6 s |

**Reduced motion** (`AccessibilityInfo.isReduceMotionEnabled()` / `prefers-reduced-motion`): no spinner rotation, no shimmer, no toast slide; keep the text labels.

## 9. Mocked vs. needs a backend

| Feature | In the mockup | Needs |
|---|---|---|
| Invite code check | Hard-coded `WIZD-2026`, client-side try counter | Server endpoint that validates + consumes a single-use code, creates a session, and rate-limits by IP/device (3 tries / 60 s). Never ship valid codes in the client. |
| Session | None | Token stored securely (SecureStore on native, httpOnly cookie on web). Owner role flag for `/admin`. |
| Course list + suggestions | 8 hard-coded courses | PCC schedule data per term (courses, sections, CRN, days/times, room, dates, units, seats, waitlist). Cached and refreshed on a schedule. |
| Professor ratings | Hard-coded | RMP lookup per instructor name + school, with the "multiple profiles" and "not found / failed" outcomes. Cache results; respect RMP's terms (permission was being requested). |
| Reviews | 5 hard-coded | RMP reviews per professor, with course, date, rating, difficulty, source URL. |
| Profile linking | Toast only | Store instructor → RMP profile mapping. |
| Invite codes admin | In-memory list | Table of codes: code, note, status (unused/used/revoked), created_at, used_by, used_at. Generate / revoke endpoints, owner-only. |
| Toasts, sorting, filtering, formatting | Real logic in the mockup | Can be reused as-is client-side. |

The project notes mention Cloudflare Pages for hosting and Supabase for data; both fit the above, but that choice is outside this design handoff.

## 10. Accessibility notes

- Touch targets ≥ 44 × 44.
- Real semantics: buttons are buttons, links are links. In RN use `Pressable` with `accessibilityRole` and `accessibilityState={{ selected / disabled / busy }}`.
- Combobox: `accessibilityRole="combobox"` on the input; the list items are options; announce the result count.
- Progress bar: `accessibilityRole="progressbar"` with `accessibilityValue {min,max,now}`.
- Score bars are images with labels ("Rating 4.6 of 5").
- Toasts use `AccessibilityInfo.announceForAccessibility`.
- On route change, move focus to the page title.

## 11. Copy

Use the copy in `design.html` as written; it's final for this pass. Voice: first person from TheWizardd, plain and short, a little playful ("A small spell for picking classes", "Choose wisely."). No exclamation marks.
