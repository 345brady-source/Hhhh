# Phase 6: deferred items

Things found during execution that are outside the plan that found them. Each needs its own plan or an owner decision.

## From plan 06-07

1. **An investor on file who now answers "not accredited" in server mode keeps the old ground in the console.**
   In local mode the status step withdraws a self-certified ground on the shared record (onboarding.js `withdrawGround`) when the investor answers "not accredited". In server mode the console's import (invitations.js `merge`, on-file branch) takes a ground only when the investor answers "accredited", and never withdraws one. The request itself is right: its qual says `accredited: false` and the 506(b) count includes the investor. Only the investor record's ground stays as it was. Fixing it means mirroring `withdrawGround` on import, including the self-certification verification record, so it is a change to accreditation records and needs its own plan and tests.

2. **Other device-supplied request fields in server mode.** Plan 06-07 makes the console set an imported subscription's `submitted` and `dealing` dates itself. `signedAt` and `signedBy` still come from the device as sent. They are display fields today (the envelope carries the signature record). They should still get a review in the phase's security pass.
