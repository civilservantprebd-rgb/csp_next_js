# BCS One - Version 1.0 (Stable)

**Release Date:** September 23, 2026
**Status:** Stable (Production Ready)

## Recent Stable Updates
* **Dynamic Leaderboard Recalculation:** The leaderboard and student scores now automatically recalculate if a teacher modifies an exam question or answer key after publication.
* **Strict Exam Lock Rules:** Exam results remain locked after the live `endTime` until the full `timerMinutes` has elapsed. Prevents premature answer exposure.
* **JSONB Payload Handling:** Updated recalculation blocks to cleanly handle the new `{qid, ans}` dictionary payload via the `isNewFormat` check.
* **Type Safety Fixes:** Resolved string literal syntax errors and type mismatches for submission answers.

## Codebase Integrity
* The current `main` branch on the `xmetriex` remote is the most stable version of this application.
* **Rule:** All future development and feature additions will be done on separate Git branches to prevent accidental breakage of this stable version.
