# BCS One - Version History

## Version 2.0 (Payment Gateway Update)
**Release Date:** September 26, 2026
**Status:** Local Branch (`version-02`)

### New Features:
* **Dynamic Payment Calculation:** Enrollment modal now calculates and displays the total course price based on the selected courses.
* **Payment Verification Flow:** Students can now view course prices inline and submit their bKash/Nagad Transaction ID (TrxID) securely.
* **Admin Dashboard Enhancement:** Admin approval panel (`StudentApproval.tsx`) now directly displays the requested amount next to the TrxID and Coupon.

---

## Version 1.0 (Stable)
**Release Date:** September 23, 2026
**Status:** Stable (Production Ready)

### Recent Stable Updates
* **Dynamic Leaderboard Recalculation:** The leaderboard and student scores now automatically recalculate if a teacher modifies an exam question or answer key after publication.
* **Strict Exam Lock Rules:** Exam results remain locked after the live `endTime` until the full `timerMinutes` has elapsed. Prevents premature answer exposure.
* **JSONB Payload Handling:** Updated recalculation blocks to cleanly handle the new `{qid, ans}` dictionary payload via the `isNewFormat` check.
* **Type Safety Fixes:** Resolved string literal syntax errors and type mismatches for submission answers.

## Codebase Integrity
* The current `main` branch on the `xmetriex` remote is the most stable version of this application.
* **Rule:** All future development and feature additions will be done on separate Git branches to prevent accidental breakage of this stable version.
