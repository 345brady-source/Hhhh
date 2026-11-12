# Investor Portal: E-signature Rebuild

## What This Is

A complete do-it-yourself investor portal that gives sponsors everything they need to onboard and manage investors, and to manage their fund to an extent. This project overhauls and essentially recreates the portal's built-in e-signature so it is market ready: it is the signing step inside investor onboarding, not a separate signing product.

## Core Value

A sponsor uploads a subscription agreement once, the signature fields land in the right place, and every investor signs it as a seamless step of onboarding with no extra account, tool or hand-off.

## Business Context

- **Customer**: Sponsors (fund managers and syndicators) who run their own investor portal; their investors are the people who sign
- **Revenue model**: Self-serve investor portal product for sponsors
- **Success metric**: A sponsor can set up signing on a real subscription agreement and have investors sign it during onboarding without help or manual correction
- **Strategy notes**: None

## Requirements

### Validated

<!-- Already built and working in the portal. -->

- ✓ Sponsor sign-up, firm branding and white-label investor portal — existing
- ✓ Offerings, document intake that reads offering documents, investor invitations — existing
- ✓ Guided investor onboarding (login, investor information, identity and accreditation checks, tax form, bank details, subscription, agreement) — existing
- ✓ Subscription agreement attached to an offering and signed during onboarding, with sponsor countersignature — existing, workable but not market ready
- ✓ Distributions, capital calls, requests, documents, reporting and audit schedules — existing

### Active

<!-- Current scope: the e-signature rebuild. -->

- [ ] Automatic field placement reads a subscription agreement and puts signature and related fields in the correct spot
- [ ] Where placement is uncertain, the portal places its best guess, flags those fields, and the sponsor must confirm them before the document can be used
- [ ] A smooth manual field editor: fields drag cleanly within a page and across pages, with none of today's jank
- [ ] The sponsor's field editor and the investor's signing screen look polished and well made, not cheap
- [ ] Once fields are set (by the portal or the sponsor), signing is a seamless part of the onboarding workflow with no further sponsor effort
- [ ] Nobody ever signs up for, or is sent to, a separate e-sign tool or account: signing happens inside the portal as part of onboarding
- [ ] Richer signature creation: more creative signature styles, including cursive options, beyond today's basic choices
- [ ] Legal-grade record: a final signed PDF with a certificate page and audit trail (who signed, when, consent to sign electronically) that stands on its own

### Out of Scope

- New signer setups (joint investors, multiple entity signatories, witnesses, side letters and amendments) — not chosen for this rebuild
- Server-side signing with emailed signing links and reminders — not chosen for this rebuild; signing stays inside the onboarding flow
- Further fund management features — the owner has decided the current extent is as much as the portal will provide
- Mobile app — set aside for now by the owner

## Context

- Static vanilla-JavaScript web app with no build step; two editions (managed and self-serve). This work targets the self-serve edition's signing, which shares code with the managed one.
- Existing signing code lives mainly in `assets/js/esign.js` and `assets/css/esign.css`, with the onboarding flow in `assets/js/onboarding.js` and `assets/js/invitations.js`, and document reading in `assets/js/reader.js` and `assets/js/intake.js`.
- Known problems reported by the owner: automatic placement often puts the signature box in the wrong spot on subscription agreements; adding fields by hand is janky and they cannot be dragged cleanly around or between pages; the feature looks cheap and poorly made; signature styles are very basic and offer no cursive.
- The onboarding system is designed to be as easy on the sponsor as possible; the signing rebuild must keep to that.
- The portal was recently restyled on a shared design system (`design.md`, `assets/css/tokens.css`); new signing screens should follow it.
- Data currently lives in the browser (localStorage and IndexedDB), with an optional integration server.

## Constraints

- **White label**: Investors only ever see the sponsor firm's brand; no product or third-party vendor names in the UI — the portal is sold as the sponsor's own
- **Security**: No provider secrets in the browser; they belong on the integration server only
- **Workflow**: Signing must stay inside onboarding with no separate sign-up — the owner's explicit requirement
- **Imagery**: No AI-generated or stock images — the owner's standing rule
- **Scope discipline**: Do not add features, prompts or gates that were not asked for; keep usage and verification proportionate

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rebuild e-signature rather than patch it | The owner judges the current one workable but not market ready | — Pending |
| Uncertain auto-placed fields are flagged and must be confirmed by the sponsor | Wrong placement is the main complaint; silent guesses caused it | — Pending |
| Include a legal-grade signed record (certificate page and audit trail) | Chosen by the owner as part of market readiness | — Pending |
| Leave out new signer setups and server-side signing | Not chosen for this round | — Pending |
| Signing stays an embedded onboarding step, never a separate tool or account | Onboarding must be as easy on the sponsor as possible | — Pending |
| Skip the codebase mapping step | The codebase is already known from prior work; mapping costs usage | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-12 after initialization*
