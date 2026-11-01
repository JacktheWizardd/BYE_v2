# BYE app design prototype

Buildless HTML/CSS/JavaScript. Open `index.html`, or serve `frontEnd` and visit `/app-ae86/`. The approved landing page's successful demo-code link opens this app.

## Flow

- Search by course code or title, choose a semester, optionally select available days.
- Search suggestions support mouse, Arrow keys, Enter, and Escape.
- All scheduled meeting days must fit selected availability; asynchronous sections remain eligible.
- Compare ratings, difficulty, and rating counts. Desktop (1024px+) shows list and report together; smaller screens use separate report navigation.
- Reports show sections, seats, waitlists, and filterable/sortable/paginated sample reviews.
- Hash URLs preserve search, sort, and selected professor. Session storage remembers the latest state. Browser back/forward and refresh are supported.

## Fixtures

Four courses, two sample terms, and course/term-linked sections. All people, schedules, seats, and reviews are illustrative. No live data, production authentication, APIs, or external dependencies. Fonts reuse the landing page's local assets.

Collapsed Prototype controls expose normal, loading, empty, and rating-error states. Professor D demonstrates unconfirmed identity; Instructor TBA demonstrates an unnamed instructor. Professor E demonstrates a failed lookup; Retry resolves to sample ratings for the current page session. Reload resets that simulated resolution.

## Verification

Browser checks covered keyboard autocomplete and validation, no-match suggestions, day filtering (Monday alone retains only asynchronous MATH 5A sections), course-specific empty results, sorting, report navigation, review controls, refresh persistence, retry, and loading/empty fixtures. Responsive overflow checks passed at 390, 768, and 1440 pixels. Screenshots are included for desktop comparison, mobile report, and tablet search.

Original Spellbook files are unchanged. Expo/native implementation and production data integration remain future work.
