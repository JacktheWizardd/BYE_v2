# BYE v2.1 handoff: Compare list and instructor report

**For:** Codex, implementing in `frontEnd/bye-web`
**From:** design, 2026-10-31
**Design source:** canvas "BYE report fixes" (https://claude.ai/artifact/TSYaFsXHr5LhmjP67odPkG), desktop artboard `Main.dc.html`. An exact copy of that artboard is next to this file as `reference-Main.dc.html`. Every value below was copied from it.

## 0. How to read this document

- **This document wins.** If this file and the reference artboard disagree, follow this file and report the mismatch. Do not guess.
- **Units are CSS px** unless stated otherwise. A value written `a b c d` follows CSS shorthand order (top right bottom left).
- **Colours are exact hex values.** Don't round them or swap them for a "close" token. Where an existing token already has the value (section 1), use the token.
- **Every visible string is listed verbatim.** Character choices matter: the mid-dot `·`, en dash `–`, curly quotes `“ ”` and `’`, and the arrows `↓ ↑ ↗`. Plain hyphens and straight quotes are wrong.
- **Scope.** Only the 02 Compare column, the 03 Instructor report, and the header change. Leave everything else alone: the search screen, the guide, auth, the API contract and the backend RMP cache.
- **Rotation.** Nothing in this spec is rotated. Never apply `transform: rotate` to any element.
- **Fonts.** `Schibsted` is Schibsted Grotesk, the body and UI font. `Mono` is JetBrains Mono, used through `var(--mono)`. Both are already loaded in `reference.css`.
- **Minimum tap target.** Every interactive control is at least **44px** tall.
- **Colour is never the only signal.** Every colour state comes with a word.

## 1. Tokens

Existing tokens in `src/reference.css :root`, unchanged:

| Token | Hex | Use here |
|---|---|---|
| `--paper` | `#f6f5f0` | page background |
| `--card` | `#fcfcf8` | inputs, stat tiles, refresh button, sync pill |
| `--ink` | `#1a1c1b` | text, borders of controls, active sort, count badge |
| `--muted` | `#5d615b` | secondary text |
| `--line` | `#d7d9d0` | hairlines, bar track, pill border |
| `--soft` | `#eaece4` | status strip, tags, review toolbar |
| `--amber` | `#f3b63f` | logo dot, Top BYE. sticker, selected-row outline, BYE card border |
| `--amber-soft` | `#f4e7c7` | BYE card background, selected row (desktop) |
| `--amber-deep` | `#9c5b00` | link hover (unchanged) |
| `--ok` | `#2f6b3d` | green seat state, "fresh" sync dot, seats-open text in rows |
| `--bad` | `#a32c20` | red seat state, "stale" sync dot |

New tokens. Add them to `:root` in `src/style.css`:

| New token | Hex | Use |
|---|---|---|
| `--zebra` | `#eeede6` | every second professor row |
| `--warn` | `#c98a00` | yellow seat-bar fill and the "partial" sync dot (fills and dots only, never text) |
| `--warn-text` | `#8a5d00` | yellow-state label text ("Almost full"). It passes 4.5:1 on paper. |
| `--rmp` | `#8f5400` | RMP rating text in rows (4.98:1 even on the amber-soft selected row; `--amber-deep` only reaches 4.37:1 there) |
| `--diff` | `#2f5487` | Difficulty text in rows |
| `--ink-2` | `#3d403b` | sync pill text, BYE card note |
| `--dash` | `#a0a399` | dashed border of the no-match box |

## 2. Header (all screens)

Structure, in order: `header > [brand group] [nav]`.

**header**
- `display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center`
- `gap: 12px 24px`
- `padding: 14px clamp(16px, 4vw, 56px)`
- `border-bottom: 1px solid var(--ink)`

**Brand group:** `display:flex; flex-wrap:wrap; align-items:center; gap:10px 14px`. It holds two children.
1. **Logo block:** `display:flex; align-items:center; gap:14px; min-height:44px`. Keep the existing wordmark: "BYE" at 26px, weight 900, letter-spacing −1.5px, line-height 1, followed by "." in `--amber`, then the existing "BEFORE / YOU ENROLL" mono stack.
2. **Sync pill (new):** `display:inline-flex; align-items:center; gap:8px; font-size:12px; color:var(--ink-2); border:1px solid var(--line); background:var(--card); padding:6px 10px`. It contains an **8×8px dot** (`border-radius:50%`, `flex:none`, `aria-hidden="true"`) followed by the label text. Put the state's detail sentence in the pill's `title`. The states are in section 8.

**nav**
- `display:flex; flex:1 1 320px; justify-content:flex-end; align-items:center`
- `gap:4px; font-size:13px; line-height:1`
- Every nav child is `display:inline-flex; align-items:center; min-height:44px`. This fixes the misalignment between the text links and the button.

| Item | Padding | Other |
|---|---|---|
| Guide (link) | `0 12px` | weight 600, no underline |
| Watches (disabled preview) | `0 12px` | colour `--muted` |
| Plan (disabled preview) | `0 12px` | colour `--muted` |
| New search (link) | `0 16px` | `margin-left:8px`, background `--ink`, colour `#ffffff`, weight 700, no underline |

On narrow screens the brand group and nav wrap onto two rows by themselves, and the nav stays right-aligned. Don't add a media query for this.

## 3. 02 Compare column

The column holds these elements, top to bottom:
1. Eyebrow
2. Heading
3. Count line
4. **Find a professor** (new)
5. **Sort bar** (changed)
6. **Sort hint** (new)
7. **Professor rows** (changed)
8. **No-match box** (new, conditional)

Column box: `flex:1 1 300px; max-width:360px; min-width:0`.

### 3.1 Eyebrow, heading and count line
- **Eyebrow** "02 / COMPARE": mono, 11px, letter-spacing 1px, `--muted`, uppercase, margin 0.
- **Heading** "Who’s teaching": 28px, weight 800, letter-spacing −0.5px, `margin:12px 0 4px`.
- **Count line:** 12px, `--muted`, margin 0. Text: `{N} sections · sorted by {sortLabel}`. The sort labels are in 3.3.

### 3.2 Find a professor
- **Wrapper:** `margin-top:16px`.
- **Label:** a `<label for="prof-search">` reading "Find a professor". `display:block; font-size:11px; font-weight:700; letter-spacing:0.5px; text-transform:uppercase; margin-bottom:4px`.
- **Field box:** `display:flex; align-items:center; border:1px solid var(--ink); background:var(--card); min-height:44px`. Square corners.
- **Search icon:** 16×16 inline SVG, `viewBox 0 0 24 24`, no fill, stroke `--muted`, stroke-width 2, round caps, `margin-left:12px; flex:none; aria-hidden`. Paths: `<circle cx="11" cy="11" r="7"/>` and `<path d="m20 20-3.5-3.5"/>`.
- **Input:** `id="prof-search" type="search" autocomplete="off"`, placeholder "Type a first or last name". `flex:1; min-width:0; border:0; background:transparent; padding:10px; font-size:14px; outline-offset:-3px`.
- **Clear button:** shown only when the trimmed query is not empty. Text "Clear", `aria-label="Clear professor search"`. `border:0; background:transparent; font-size:12px; font-weight:600; min-height:44px; padding:0 12px; text-decoration:underline; text-underline-offset:3px`. Clicking it empties the query and returns focus to the input.
- **Helper line:** `margin:6px 0 0; font-size:12px; color:var(--muted)`.
  - Query empty: `Matches first or last name, e.g. “kasfy” or “chris”.`
  - Query typed: `{shown} of {total} professors match`, where *total* is every professor teaching this course.

**Matching rule** (run it exactly like this):
1. Trim the query, lowercase it, and split it on whitespace into parts.
2. Lowercase the professor's name and split it on spaces into words.
3. The professor matches when **every** part is a **prefix** of **at least one** word.
4. For example, "kas" matches Hassan Kasfy, "chris lor" matches Christine Loritsch, and "tsch" matches nobody.
5. Also strip diacritics on both sides (NFD normalise, then remove marks), so "jose" matches "José".

Filtering runs on every keystroke, with no debounce. The list is client-side and already loaded. The query is not saved and resets when the course changes.

### 3.3 Sort bar
- **Container:** `role="group" aria-label="Sort instructors"`. `display:flex; border:1px solid var(--ink); margin:16px 0 6px`. Use flex, not a 5-column equal grid: equal columns clip the active label "BYE score ↓" (it needs 76px and an equal column is only 54–59px)..
- **Buttons, in order:** Name · Rating · Difficulty · BYE score · # Ratings.
- **Each button:** `flex:1 1 auto; border:0; font-size:11px; font-weight:700; min-height:44px; padding:8px 6px; white-space:nowrap`. Buttons 1 to 4 also get `border-right:1px solid var(--ink)`, and the fifth has no right border.
- **Inactive:** background transparent, colour `--ink`. **Active:** background `--ink`, colour `#ffffff`, `aria-pressed="true"`. Inactive buttons get `aria-pressed="false"`.
- **Active label:** the button's label plus a space and an arrow: `↓` in the default direction, `↑` when reversed. For example "BYE score ↓". Inactive buttons show no arrow.

**Behaviour:**
- Tapping an inactive button makes it active in its **default** direction.
- Tapping the active button flips the direction.
- Switching to another button always starts in that button's default direction.
- The default on load is **BYE score ↓**.

| Key | Default direction | Count-line label (default) | Count-line label (reversed) |
|---|---|---|---|
| Name | A to Z (locale compare) | `name, A–Z` | `name, Z–A` |
| Rating | high to low | `rating, high to low` | `rating, low to high` |
| Difficulty | low to high (easiest first) | `difficulty, easiest first` | `difficulty, hardest first` |
| BYE score | high to low | `BYE score, highest first` | `BYE score, lowest first` |
| # Ratings | most to fewest | `number of ratings, most first` | `number of ratings, fewest first` |

Professors whose sort value is null (no confirmed RMP profile) always go to the **bottom**, in both directions. Ties keep the current stable order.

### 3.4 Sort hint
`margin:0 0 14px; font-size:12px; color:var(--muted)`. The text depends on the active sort.
- **BYE score:** `BYE score (0–100) combines RMP rating and ease (low difficulty), 50/50. Few ratings pull it toward 50. Tap again to reverse.` The "50/50" comes from the weight constant in section 4, so build it from that constant.
- **Any other sort:** `Tap a sort again to reverse it.`

### 3.5 Professor row
Each professor row is a `<button>` that fills the full width of the list.

**Row box:**
- `display:block; width:100%; text-align:left; line-height:1.35`
- `padding:10px 12px; min-height:64px`
- `border:0; border-bottom:1px solid var(--line)`

**Row background,** applied by **visual position after sorting and filtering**, with the index counted from 0:

| Condition | Style |
|---|---|
| Desktop layout (section 9) **and** this professor is the one open in the report | `background:var(--amber-soft); outline:1px solid var(--amber); outline-offset:-1px` |
| Otherwise, index is odd (the 2nd, 4th, 6th… row) | `background:var(--zebra)` |
| Otherwise | transparent |

The phone layout never shows the amber "open" style, because tapping a row opens the report. Phone does keep the zebra tint.

**Inner grid:** `display:grid; grid-template-columns:20px minmax(0,1fr) 52px; column-gap:8px; align-items:start`. Text in the middle column must never run into the 52px score column.

| Column | Content | Style |
|---|---|---|
| 1 (20px) | Position number, two digits: `01`, `02` … `10` | mono 10px, `--muted`, `padding-top:4px` |
| 2 (fluid) | Three stacked lines, `display:flex; flex-direction:column; gap:2px; min-width:0` | see below |
| 3 (52px) | Score and tag | `text-align:right; line-height:1` |

The position number is the row's place in the current order, so it changes when you re-sort or filter.

**Column 2, line by line:**
1. **Name:** 15px, weight 800, `--ink`.
2. **Scores** (only when the professor has an RMP profile): `display:flex; flex-wrap:wrap; gap:2px 12px; font-size:12px; font-weight:600`.
   - `★ RMP {rating}/5` in `--rmp`.
   - `▲ Difficulty {difficulty}/5` in `--diff`.
   - Print the values as the API sends them, for example 4.4 and 3.7.
   - **No profile:** this line is `Profile needs confirming` at 12px in `--muted`, weight 400.
3. **Counts:** 12px, as two inline spans.
   - `{review_count} ratings · ` in `--muted`. Leave this span out entirely when `review_count` is 0 or null.
   - `{S} section(s) · {O} open` in `--ok` (the word "seats" is left out on purpose, so the line fits on one line in the 300px desktop column). Use the singular "1 section". `{O}` is the sum of `seats_open` across this professor's sections, using the existing `seatSummary` rules. If any seat count is unknown, follow the existing unknown-count wording, still in `--ok`.

**Column 3, the score:**
- **Normal:** the BYE score as an integer, `display:block; font-size:20px; font-weight:800; color:var(--ink)`. Below it a tag reading `BYE`: `display:block`, mono 9px, `--muted`, `margin-top:4px`.
- **Top of class** (rule in 4.3): the score is `display:inline-block; font-size:18px; font-weight:900; color:var(--ink); background:var(--amber); padding:2px 6px`, and the tag reads `TOP BYE.`, with the same tag style.
- **No score:** show `—` (an em dash) in the normal style, with the tag `BYE`.

### 3.6 No-match box
Shown when the query is not empty and no professor matches. It takes the place of the rows.
- **Box:** `padding:20px 14px; border:1px dashed var(--dash)`.
- **Line 1:** `No one named “{query}” teaches {COURSE CODE} this semester.` 15px, weight 800, margin 0. `{query}` is the raw trimmed query, and `{COURSE CODE}` is the display code, for example `MATH 005A`.
- **Line 2:** `Check the spelling, try just a last name, or search another class.` 12px, `--muted`, `margin:6px 0 0`. "search another class" is a link to the search screen with `text-underline-offset:3px`.

## 4. BYE score (new pure function)

Create `src/byeScore.ts` with no React and no side effects.

```ts
export const BYE_RATING_WEIGHT = 0.5;   // share given to rating; ease gets 1 - this
export const BYE_TRUST_AFTER  = 10;     // pseudo-ratings pulling toward 50
export function byeScore(rating: number|null, difficulty: number|null, count: number|null): number|null {
  if (rating == null || difficulty == null) return null;
  const n = Math.max(0, count ?? 0);
  const w = BYE_RATING_WEIGHT, k = BYE_TRUST_AFTER;
  const base = w * (rating - 1) / 4 + (1 - w) * (5 - difficulty) / 4;   // 0..1
  return Math.round(100 * (n * base + k * 0.5) / (n + k));            // 0..100 integer
}
```

### 4.1 Inputs
Take `rating`, `difficulty` and `review_count` from the confirmed RMP `Profile`. Don't clamp `rating` or `difficulty`, since the API already returns values from 1 to 5. Rounding is JavaScript `Math.round`, which rounds .5 up.

### 4.2 Required unit tests
Add these to `src/byeScore.test.ts`. Each row must equal the expected value exactly.

| rating | difficulty | count | expected |
|---|---|---|---|
| 4.4 | 3.7 | 62 | **58** |
| 4.1 | 3.4 | 185 | **58** |
| 3.2 | 2.9 | 54 | **53** |
| 3.3 | 3.5 | 339 | **48** |
| 5 | 1 | 0 | **50** |
| 5 | 1 | 10 | **75** |
| 5 | 1 | 1000 | **100** |
| 1 | 5 | 1000 | **0** |
| 3 | 3 | 5 | **50** |
| null | 3 | 10 | **null** |
| 4 | null | 10 | **null** |

### 4.3 "Top BYE." rule
Compute *top* over **all** professors teaching this course in this term. Use the full list, not the search-filtered list, and ignore sort direction.

- *top* is the highest non-null score.
- **Every** professor whose score equals *top* is "top", so ties all qualify.
- If every score is null, nobody is top.

### 4.4 Loading
RMP summaries load one by one, and the score can't exist until a professor's profile has loaded.

- Show `—` until a professor's profile arrives.
- Recompute *top* every time a profile arrives. The yellow sticker can move while summaries are loading, and that's acceptable.
- When the BYE score sort is selected, reuse the existing "resolve the rest before applying a comparison sort" behaviour.

## 5. 03 Instructor report, top of the report

These elements stack in order:
1. Eyebrow "03 / INSTRUCTOR REPORT": same style as the Compare eyebrow.
2. Professor name: 44px, weight 800, letter-spacing −1.6px, line-height 1.1, `margin:12px 0 8px`.
3. School line: 13px, `--muted`, `padding-bottom:24px; border-bottom:1px solid var(--line)`.
4. **BYE score card** (new).
5. Rate My Professors block.
6. Sections block.
7. Original reviews block.

### 5.1 BYE score card
- **Card:** `margin-top:32px; display:flex; flex-wrap:wrap; align-items:center; gap:16px 28px; background:var(--amber-soft); border:1px solid var(--amber); padding:20px 24px`. Square corners.
- **Left side:** `display:flex; align-items:baseline; gap:4px`.
  - The score: 56px, weight 900, letter-spacing −2px, line-height 1.
  - Then `/100`: 14px, weight 700.
  - With no score, show `—` and still show `/100`.
- **Right side:** `flex:1 1 260px; min-width:0`.
  - **Label line:** mono 11px, letter-spacing 1px, uppercase, margin 0, text `BYE score`.
  - **Top tag:** only when this professor is top (4.3), add a tag directly after the label text: `display:inline-block; margin-left:10px; background:var(--amber); color:var(--ink); font-weight:700; padding:3px 8px; letter-spacing:0.5px`. Text: `Top BYE. in {COURSE CODE}`. It inherits the label line's mono 11px uppercase, so it renders as "TOP BYE. IN MATH 005A".
  - **Note:** `margin:4px 0 0; font-size:13px; color:var(--ink-2)`. With a score: `Rating + ease · {review_count} ratings`. Without a score: `Needs a confirmed RMP profile.`

### 5.2 Rate My Professors block
- **Block:** `margin-top:40px`. Heading row: `display:flex; flex-wrap:wrap; justify-content:space-between; align-items:baseline; gap:8px 16px; margin-bottom:16px`. The h3 reads "Rate My Professors" at 22px, weight 800.
- **Tiles:** keep the existing `.stats` element with these exact values.
  - Grid: `repeat(3, minmax(0,1fr))`, `border:1px solid var(--line)`, background `--card`.
  - Each tile: `padding:18px 16px`. Every tile except the last gets `border-right:1px solid var(--line)`.
  - Number: 34px, weight 800, letter-spacing −1px, line-height 1.1. Suffix (`/5`, `/5` or `%`): 13px, `margin-left:3px`.
  - Caption: `margin:6px 0 0`, 12px, `--muted`. Captions in order: `Rating · higher is better`, `Difficulty · lower is easier`, `Would take again`.
  - A missing value shows `—`.
- **Meta line** under the tiles: `display:flex; flex-wrap:wrap; gap:6px 18px; margin-top:12px; font-size:12px; color:var(--muted)`. Its items, in order:
  1. `Matched: ` followed by the matched name in bold `--ink`, then ` · {review_count} ratings`.
  2. A link reading `Original on RMP ↗` to `source_url`, with `text-underline-offset:3px`.
  3. `Checked {checked_at}`, using the existing date format.
  4. A link reading `Change profile`, which opens the existing chooser, with `text-underline-offset:3px`.

## 6. Sections block

Replace the current Sections header. **Delete all of the following:**
- the heading "Sections / N"
- the "Refresh saved counts" link
- the helper sentence "Reloads BYE’s saved counts. PCC checks run on a shared five-minute schedule."
- the per-card mono line "Checked 9:44 PM · 3 min ago"

### 6.1 Heading row
- Block: `margin-top:40px`. Row: `display:flex; align-items:center; gap:10px; margin-bottom:12px`.
- h3: "Sections", 22px, weight 800, margin 0.
- **Count badge:** mono 11px, weight 700, background `--ink`, colour `#ffffff`, `padding:3px 8px`. Square. The value is the number of section cards shown.

### 6.2 Status strip
There is exactly **one** strip per Sections block, and it controls **every** section.
- **Strip:** `display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:8px 16px; background:var(--soft); padding:4px 4px 4px 14px; margin-bottom:4px`.
- **Left:** 12px, `--muted`. An 8×8 dot (`display:inline-block; border-radius:50%; margin-right:8px`) coloured by sync state, followed by the state's strip text (section 8).
- **Right, the Refresh all button:** `display:inline-flex; align-items:center; gap:6px; border:0; background:var(--card); font-size:12px; font-weight:700; min-height:44px; padding:0 12px`.
  - **Icon:** 14×14 SVG, `viewBox 0 0 24 24`, no fill, `stroke:currentColor`, width 2, round caps and joins, `aria-hidden`. Paths: `M20 11a8 8 0 1 0-2.3 5.7` and `M20 4v7h-7`.
  - **Label:** `Refresh all`.
  - **Behaviour:** the same as the current "Refresh saved counts": one stored-sections reload that covers every section. Section cards have no refresh control of their own.

### 6.3 Section card
**Card:** `display:flex; flex-wrap:wrap; justify-content:space-between; gap:16px 24px; padding:22px 0; border-top:1px solid var(--line)`.

**Left part** (`flex:1 1 280px; min-width:0`):
1. **Tags row:** `display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px`, mono 10px. Each tag has background `--soft` and `padding:4px 7px`. Show `CRN {crn}`, then the delivery and format tags the app already shows.
2. **Meeting line:** h4, 17px, weight 800, margin 0, for example `M, W · 1:15 PM–3:45 PM`. Keep the existing format.
3. **Details:** `margin:4px 0 0`, 12px, `--muted`, line-height 1.7. Two lines: `Room {room} · {start} – {end}` and `{units} units · Times in America/Los_Angeles`. Keep the existing formatting.
4. **Actions:** `display:flex; flex-wrap:wrap; gap:14px; align-items:center; margin-top:10px; font-size:12px`.
   - `Copy CRN`: weight 600, underline, `text-underline-offset:3px`, `min-height:44px`.
   - The existing disabled "Add to plan | LATER" preview, unchanged.

**Right part, seats** (`flex:0 0 auto`). It sits on the right on desktop and wraps under the left part on narrow screens, where it stays left-aligned.
1. **Number:** `seats_open`. `display:block; font-size:32px; font-weight:800; line-height:1`.
2. **Seat bar:**
   - Track: `width:160px; height:6px; background:var(--line); margin:8px 0 0`.
   - Fill: `height:6px`, colour by state (6.4).
   - The bar carries `role="img"` and `aria-label="{taken} of {capacity} seats taken, {state phrase}"`.
3. **State label:** `margin:6px 0 0; font-size:12px; font-weight:700`, colour by state.
4. **Detail:** `margin:2px 0 0; font-size:12px; color:var(--muted)`. Two lines: `of {capacity} seats open` and `Waitlist {waitlist}`, the second as the existing waitlist text.

### 6.4 Seat states
These rules are exact. They use `open = seats_open` and `cap = capacity`.

**Fill width:** `taken = cap − open`, and the fill width is `round(100 × taken / cap)%`, clamped to 0–100. The bar fills up as seats are **taken**, so a full bar means a full class. When the width works out to 0%, add `min-width:4px` so the state colour still shows.

| Condition (checked top to bottom) | Fill colour | Label text | Label colour |
|---|---|---|---|
| `open` or `cap` is null | no fill (track only) | `Seat count not published` | `--muted`, weight 400 |
| `open` ≤ 0 | `--bad` (fill 100%) | `Full · waitlist {waitlist_count} of {waitlist capacity}`. Use the existing waitlist text when the capacity is unknown. | `--bad` |
| `open` is 1 or 2 | `--bad` | `Only 1 seat left` when 1, `Only 2 seats left` when 2 | `--bad` |
| `open` is 3 to 5 | `--warn` | `Almost full` | `--warn-text` |
| `open` ≥ 6 | `--ok` | `Plenty of seats` | `--ok` |

**Worked examples:**

| Example | Number | Fill width | Fill colour | Label |
|---|---|---|---|---|
| 28 open of 28 | 28 | 0% (4px stub) | green | Plenty of seats |
| 2 open of 30 | 2 | 93% | red | Only 2 seats left |
| 4 open of 30 | 4 | 87% | `#c98a00` | Almost full |
| 18 open of 30 | 18 | 40% | green | Plenty of seats |

## 7. Original reviews block

- **Block:** `margin-top:40px`. Heading row is the same as 5.2: an h3 reading "Original reviews" on the left, and on the right `From RMP · shown as written` at 12px in `--muted`.
- **Toolbar:** `display:flex; flex-wrap:wrap; gap:12px 20px; align-items:flex-end; padding:14px 16px; background:var(--soft); margin-bottom:6px`.
  - **Course control:** wrapper `flex:1 1 200px; max-width:280px`. Label `Course`: 11px, weight 700, letter-spacing 0.5px, uppercase, `margin-bottom:4px`. Select: `width:100%; min-height:44px; padding:6px 10px; border:1px solid var(--ink); background:var(--card); font-size:14px; border-radius:0`. The options are the **existing** source-course filter. Put the current class first and label it `{CODE} (this class)`.
  - **Show control:** label `Show`, styled like the Course label. The chips sit in a group with `role="group" aria-label="Review order"` and `display:flex; flex-wrap:wrap; gap:6px`.
    - Chips: `All`, `Most recent`, `Highest`, `Lowest`.
    - Each chip: `border:1px solid var(--ink); font-size:12px; font-weight:600; min-height:44px; padding:6px 12px`. Active chip: background `--ink` with white text, plus `aria-pressed`.
    - These chips reorder **only the reviews already loaded**, on the client. All keeps the API order, Most recent sorts by date descending, and Highest and Lowest sort by quality. They don't trigger any new API call.
- **Review rows:** unchanged from the current app, except that a review card is never run into a heading. That was the old "MATH 005AReview course" bug.

## 8. Schedule sync state

There are three states, and both the header pill (2) and the Sections strip (6.2) use them. Compute the state from `availability.as_of` across the sections shown, and from the result of the most recent refresh.

| State | Rule | Dot | Header pill label | Strip text |
|---|---|---|---|---|
| fresh | every shown section has `as_of` ≤ 10 min old, and the last refresh did not fail | `--ok` | `Schedule up to date` | `Seat counts for all sections · {h:mm A} · {n} min ago` |
| partial | at least one section is fresh and at least one is older than 10 min or has null availability | `--warn` | `Some sections behind` | `{x} of {y} sections not checked since {oldest h:mm A} · Refresh all to retry` |
| stale | no section is fresh, or the last refresh request failed | `--bad` | `Schedule out of sync` | `PCC unreachable since {h:mm A} · seat counts may be wrong` |

Pill `title` text for each state:
- fresh: `Every section was checked against PCC in the last 10 minutes.`
- partial: `Some sections could not be re-checked against PCC.`
- stale: `BYE could not reach the PCC schedule; all counts are old.`

The 10-minute threshold is twice PCC's 5-minute check cycle. Keep it as one named constant, `SYNC_FRESH_MS = 600000`. Outside a course context, such as the search screen, the header pill shows the most recent state for the current term.

## 9. Layout and breakpoints

- **Main area:** `display:flex; flex-wrap:wrap; gap:40px; padding:32px clamp(16px, 4vw, 56px) 64px; align-items:flex-start`.
  - Compare column: `flex:1 1 300px; max-width:360px; min-width:0`.
  - Report column: `flex:999 1 560px; min-width:0`.
- **Desktop layout:** both columns side by side. At a 1440px viewport, the content is 1328px wide. Because the report has `flex-grow:999` and the list has `flex-grow:1`, almost all spare width goes to the report, so the list renders about **300px** wide (300.4px measured), then a 40px gap, then a report about **988px** wide (987.6px measured). The list's `max-width:360px` only applies if the report can't grow. On a 390px phone the list is 358px wide.
- **Phone layout:** whenever the columns don't fit side by side (content narrower than 900px), use the app's existing phone routing: the list on its own screen, and tapping a row opens the report. Phone rows have no amber "open" highlight, but do have zebra tints.
- **No horizontal overflow** at 390, 768 or 1440px. These are the same acceptance widths as before.

## 10. Data mapping

| UI | Source |
|---|---|
| rating, difficulty, review_count, would_take_again, source_url | `Profile` in `src/rmp.tsx` (`rating`, `difficulty`, `review_count`, `would_take_again`, `source_url`) |
| BYE score | `byeScore(profile.rating, profile.difficulty, profile.review_count)` |
| seats_open, capacity, waitlist_count, as_of | `Section.availability` in `src/api.ts` |
| section count per professor | existing grouping (`groups`) |
| course code in copy | the existing `course.code` display value |

## 11. Docs to update in the same change

- **`backEnd/docs/RMP_INTEGRATION.md`, line 13.** Replace "No AI summaries or combined BYE/RMP scores." with "No AI summaries. BYE shows its own combined BYE score (rating + ease, see `frontEnd/bye-web/src/byeScore.ts`); RMP's original values are always shown alongside it."
- **`frontEnd/bye-web/README.md`.** Add one line about the BYE score, professor search, reversible sorts, seat-bar states and sync states.

## 12. Acceptance checklist

1. [ ] All 11 `byeScore` test rows pass. The existing 20 frontend tests and 33 backend tests still pass, along with TypeScript and the production build.
2. [ ] Typing "kas" leaves only Hassan Kasfy. "xyz" shows the no-match box with the exact copy. Clear empties the field and restores the full list.
3. [ ] The default sort is BYE score ↓. Tapping it again shows ↑ and reverses the order. Tapping Name gives A–Z and "↓". Null scores stay at the bottom in both directions.
4. [ ] Every second row is `#eeede6` on desktop and phone. On desktop the open professor shows amber instead. The phone list never shows amber.
5. [ ] Row text never enters the 52px score column at 390, 768 or 1440px.
6. [ ] With the sample data, Christine Loritsch and Frank Bermudez both show a yellow 58 with "TOP BYE.". Gonzaga Mendez shows 53 and Hassan Kasfy shows 48, both with "BYE".
7. [ ] Nothing is rotated anywhere.
8. [ ] The Sections block has one strip and one "Refresh all", and no card has its own refresh or check-time line.
9. [ ] The seat bars match the four worked examples in 6.4 exactly: colour, width and label.
10. [ ] The header nav items are all 44px tall and centred on one line, and the sync pill shows the right state.
11. [ ] Every control is at least 44px tall. Every colour state has a text label.
12. [ ] No horizontal overflow at 390, 768 or 1440px. Take screenshots at those widths and save them in `exports/`.
