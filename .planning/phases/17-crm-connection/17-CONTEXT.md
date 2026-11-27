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
