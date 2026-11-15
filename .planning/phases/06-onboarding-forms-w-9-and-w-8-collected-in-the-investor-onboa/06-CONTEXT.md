# Phase 06: Onboarding forms - Context

## Decisions (owner)
- D-01 (2026-11-15, from 01.4 RESUME, owner's next work list item 2): W-9 for US investors and W-8BEN / W-8BEN-E for foreign investors are filled in the portal during onboarding, known answers pre-filled and editable, e-signed. Investor-status questions by exemption: 506(b) accredited or sophisticated non-accredited (non-accredited count kept against the 35 limit); Reg A Tier 2 self-certification of the 10 percent investment limit; benefit-plan investor (ERISA) questions with the 25 percent-of-class test tracked for the sponsor.
- D-02 (owner): TIN matching with the IRS is left out.
- D-03 (2026-11-15, 01.4 D-46): tax forms attached to a subscription agreement get no fields from the subscription reader; this step collects them instead.
- D-04 (owner, 2026-11-15, verbatim: "for the w-9 use a fillable version of the form if possible"): the W-9 is the official IRS fillable PDF, filled through its own form fields, then e-signed; the same for the W-8 forms where the IRS fillable PDF allows it.
- Carried from earlier phases: two people only, investor and sponsor (D-30); investor fields never mandatory; white label; the word "basic" is never used.
