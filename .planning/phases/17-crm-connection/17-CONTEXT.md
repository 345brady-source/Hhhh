# Phase 17: CRM connection (HubSpot) — context

## Owner decisions (2026-11-27, AskUserQuestion answers)
- D-01: plan now (researcher, planner, plan check), build after phase 16's plans are merged, finished before step 12 (the reorganize step).
- D-02: the sponsor's own Integrations page may name "HubSpot" so the sponsor knows what it is connecting (sponsors only; the same exception as the ID-check provider's own page). Investors never see the CRM's name, and nothing an investor or prospect receives names it.

## Carried rules
- Built in-house at $0 through the integration server's provider-neutral connector framework (task 28); the sponsor connects its own account (HubSpot has a free CRM tier; current plan prices and API limits per plan to be confirmed by the researcher from HubSpot's own pages).
- No taxpayer number, bank or account number, ID document or accreditation evidence is ever sent to the CRM; only name, email, phone (if given), offering, commitment amount and onboarding status, unless the owner decides otherwise.
- Credentials (the sponsor's HubSpot token or OAuth grant) are sealed on the server like other provider credentials; never in the browser workspace, logs or the sent log.
- Roles: connecting and configuring needs 'configure'; reading CRM data in the console needs 'personal'.
- Fixtures use never-issued numbers; no real HubSpot account is used in checks (a local stand-in of the API); a live run with a sponsor's own account is an owner checkpoint.
- Never the owner's forbidden word; white label as in D-02.

## Owner decisions after research (2026-11-27, AskUserQuestion answers)
- D-03 (research open question 3): send the investor's offering-email opt-out to the CRM as a contact property (one more scope, crm.schemas.contacts.write); never use the CRM's own "unsubscribe from all". Counsel confirms the email-law side ("To be confirmed with counsel" until then).
- D-04 (open question 2): build a CSV export now, of exactly the same fixed field list (names, emails, offerings, amounts, stages, the opt-out flag), for any CRM; same roles and change-log rules as the sync; never any taxpayer, bank, ID, address or accreditation data.
- D-05 (open question 6): co-investors (second holders and co-signers) also become CRM contacts, each associated with the same deal as the main investor; matched by email like any contact; the same fixed field list.

## Orchestrator defaults (open questions not asked; the owner may override)
- C-01 (q1): the live check runs on a free HubSpot account first (CRM-17 owner checkpoint).
- C-02 (q4): leads in the picker are contacts at lifecycle stage Lead, with text search.
- C-03 (q5): the investor-facing privacy sentence is written by counsel, no vendor named; until then "To be confirmed with counsel".
- C-04 (q7): the Owner gets a notice when a CRM is connected, through 15-14's security notices once merged; until then the change-log entry is the record.
- C-05: auth by the sponsor's HubSpot service key (or an older private-app token) pasted into an "Access key" field, sealed (research §2); an OAuth marketplace app only later.
- C-06: 15-20's purge must delete the CRM collections; whichever of 15-20 and phase 17's server plan merges second adds that line.
- Waits (research): 15-17 hard for every plan; 15-08 hard for console plans; 15-14 soft; 15-18 not beside a phase 17 plan editing index.mjs.
- HubSpot facts are from search extracts (the vendor hosts did not resolve in this session): confidence LOW-MEDIUM until the live run.
