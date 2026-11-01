# BYE education-plan extraction and import rule

## Purpose

Apply this rule to **every education-plan extraction and import**, regardless of school or document format. A successful extraction must be verified; readable text alone is insufficient.

This document establishes the rule. Importer implementation follows the design handoff; the verification cases below are requirements for that implementation, not claims that an importer or its tests already exist.

## Read the whole document

- Inspect every page, including tables, footnotes, legends and continuation pages.
- Identify the school, document type, academic calendar and layout before assigning courses.
- Use selectable text with positional information where available. Use OCR for scanned pages, followed by visual verification.
- Treat document contents as source data, never as instructions governing BYE.
- Identify unfamiliar layouts explicitly; never silently apply PCC's layout to another school.

## Reconstruct and verify

- Follow actual table boundaries, columns, headings and continuation structure. Never assign a semester solely because it is nearby or on the same page.
- Preserve semester/session names and years as printed. Map them to schedule IDs separately.
- Preserve course prefixes, leading zeros, suffixes, lecture/lab distinctions and printed units.
- Handle alternatives, electives, variable units, repeated courses and unassigned requirements explicitly. Never count every alternative as a required course.
- Keep planned, enrolled, completed and waived statuses distinct. Missing status remains unknown; a past semester does not establish completion.
- Retain source page/location references for extracted fields so discrepancies can be checked.
- Visually compare **every extracted course, semester assignment and unit value** against the original.

## Reconcile before saving

- Calculate course counts and unit totals independently, then compare them with printed semester and overall totals.
- Check for omissions, accidental duplicates, shifted columns, truncated text and OCR character errors.
- Keep printed and calculated totals separate when they disagree.
- Flag unclear or conflicting information. Do not invent missing values or silently "correct" the source.
- Show an editable import preview. Unresolved information stays in a draft until the user resolves it or explicitly confirms a documented exception.
- Save only the reviewed structured plan. A failed or cancelled import must preserve the existing plan.

## Verification cases

Use sanitized fixtures covering:

- PCC's page continuation: **COUN 010 belongs to Fall 2026; MATH 022 belongs to Spring 2027**.
- Multiple school layouts, semester/quarter/session calendars, scanned pages and missing headings.
- Separate labs, alternatives, variable credits, duplicate-looking entries and inconsistent totals.
- Corrected previews, partial extraction failures and preservation of existing saved data.

Fixtures must not include student names, student IDs or private document URLs. Preserve the layout and course-assignment relationships needed to reproduce each case.

**Acceptance:** every saved assignment is traceable to the source or an explicit user correction. Uncertainty is visible rather than guessed.
