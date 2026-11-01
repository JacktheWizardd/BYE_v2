# V1 data brought into v2

The Fall 2026 course catalog is a dated reference retrieved October 18, 2026: 1,101 unique published course codes and display-title-cased titles. It is stored in backend-only bye_course_reference, with a source blob identifier, original retrieval date and local file SHA-256. No live courses, sections, instructors, availability or freshness timestamps are overwritten. All 1,101 codes already exist in the v2 Fall 2026 catalog; this import adds historical provenance, not new offerings.

manifest.json identifies every source and destination. Schedule fixtures are stored under test/fixtures/v1. Summer ETH 014 contains 15 source example rows covering 14 CRNs, including a two-meeting hybrid section. The synthetic Fall fixture contains intentionally fictional names and edge cases. Neither is production schedule data. The RMP reference contains two ambiguous same-name examples (Daniel Hamman and Jose Lopez) with two candidate IDs each. They are regression cases, not confirmed identity mappings; scores and review bodies were excluded.

Run node --test test/v1-import.test.js for provenance, normalization, identity ambiguity and database access checks. The server-only scripts/import-v1-catalog.js can repeat the pinned catalog import with SUPABASE_URL and BYE_DATABASE_SECRET supplied privately through the environment. It verifies the file checksum, ignores an existing ID, and verifies the stored result. Do not put the database secret into frontend configuration.

Not recovered: the original v1 database's professor/course directory and complete local schedule snapshots. The old project is not visible through the current connector. Neither Spring 2025 nor Fall 2025 gains a recovered full schedule from these repositories. No BYE student reviews were copied.
