# Legacy regression fixtures

These fixtures exercise parser and matching behavior; they are not production offerings or verified professor identities.

- `pcc-summer-2026-eth014.json` retains the legacy meeting structure, hybrid duplicate-CRN relationship and missing availability. Instructor names, CRNs and room identifiers are fictional.
- `rmp-ambiguous-identities.json` uses fictional names, institution labels and profile identifiers to reproduce same-name ambiguity. No live source requests are permitted in its tests.
- `fall-2026-synthetic.json` is the existing synthetic suffix/meeting/status fixture.

The manifest in `backEnd/reference/v1` records the upstream structural references. Original local identity fixtures are excluded from Git.
