/*
 * Editions: one codebase, two products.
 *
 *   managed  Carrow & Vale runs each client's portal. Carrow & Vale staff use
 *            the operator bar, set up clients, and add and configure
 *            offerings; the sponsor's own staff run day-to-day operations.
 *   diy      self-serve: the sponsor signs up on Carrow & Vale and runs everything
 *            alone. Admins have every feature; team members run operations;
 *            investors are verified automatically through the identity,
 *            sanctions screening and accreditation providers the sponsor
 *            connects (integrations.js).
 *
 * The entry page picks one: index.html is the managed edition and diy.html
 * sets window.CVPortalEdition = 'diy' before the scripts load. ?edition=diy
 * (or managed) overrides it for testing.
 */
(function () {
  'use strict';
  const NS = (window.CVPortal = window.CVPortal || {});
  let id = window.CVPortalEdition === 'diy' ? 'diy' : 'managed';
  try {
    const q = new URLSearchParams(location.search).get('edition');
    if (q === 'diy' || q === 'managed') id = q;
  } catch (e) {
    /* ignore */
  }
  const diy = id === 'diy';
  NS.EDITION = Object.freeze({
    id,
    diy,
    managed: !diy,
    /** The product name firms see on sign-up. Investors never see it: their portal carries only their firm's brand. */
    product: 'Carrow & Vale',
    /** "Powered by" footer option (managed edition only; the self-serve edition is fully white-labeled). */
    poweredBy: diy ? '' : 'Carrow & Vale',
    /** Kept apart so both editions can run in one browser. */
    storagePrefix: diy ? 'sdesk1:' : 'cvp2:',
    roles: diy ? ['admin', 'team', 'investor'] : ['staff', 'sponsor', 'investor'],
    roleLabel: diy ? { admin: 'Admin', team: 'Team member', investor: 'Investor' } : { staff: 'Carrow & Vale staff', sponsor: 'Sponsor staff', investor: 'Investor' },
    /** Full control: offerings, brand, offering intake, integrations, team. */
    owner: diy ? 'admin' : 'staff',
    /** Runs operations (distributions, calls, requests, documents, notices) but cannot reconfigure. */
    team: diy ? 'team' : 'sponsor',
    /** Who a team member asks when something is locked. */
    askWho: diy ? 'an admin on your team' : 'your Carrow & Vale team',
    lockedBy: diy ? 'your admins' : 'Carrow & Vale',
    /** Automated identity, sanctions screening and accreditation through connected providers. */
    integrations: diy
  });
})();
