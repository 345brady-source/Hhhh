/*
 * Who may do what in the self-serve console: one table that the browser and the server both read (plan 15-12, SE-05).
 * The server loads this same file (server/lib/roles.mjs), so the two can never differ. The browser copy only hides
 * and disables; the server refuses.
 *
 * This file works on plain data only. It touches nothing when it loads, so it also loads outside a browser
 * (module.exports under Node). Self-serve edition only: the managed edition keeps its own three roles and never loads it.
 *
 *   ROLES                   the five console roles, in the order the Team page lists them ('team' is the key for Staff,
 *                           kept so saved workspaces keep working)
 *   LABELS                  each role's name on screen
 *   LINES                   each role in one line, for the Team page
 *   PERMISSIONS             the ten permissions
 *   allows(role, perm)      true when the role has the permission; an unknown role or permission is never allowed
 *   permissionsOf(role)     the permissions the role has, in PERMISSIONS order
 *   PAGES                   console page key → { role: 'act' | 'read' | 'hidden' }
 *   DEFAULT_PAGES           page keys deliberately left on the default (none today)
 *   pageAccess(role, key)   the page's value for the role; a page not in PAGES gets the default: Owner, Admin and Staff
 *                           'act', Read-only 'read', the Accountant 'hidden'
 *   REFUSALS                permission → the one sentence a refusal shows ('never' for what no role may change this way)
 */
(function (NS) {
  'use strict';

  const ROLES = Object.freeze(['owner', 'admin', 'team', 'readonly', 'accountant']);

  const LABELS = Object.freeze({ owner: 'Owner', admin: 'Admin', team: 'Staff', readonly: 'Read-only', accountant: 'Accountant' });

  const LINES = Object.freeze({
    owner: 'Everything, including billing, sign-in rules and closing the portal',
    admin: 'Everything except billing and ownership',
    team: 'Day-to-day work; payments are released by an Admin or the Owner',
    readonly: 'Sees everything, changes nothing; bank numbers show the last four digits',
    accountant: 'Reports, the audit file, capital accounts and tax documents only; access ends on a date'
  });

  const PERMISSIONS = Object.freeze(['view', 'operate', 'pay', 'spend', 'configure', 'team', 'account', 'personal', 'audit', 'reports']);

  // Each role's permissions. Staff never release payments or spend (C-10); Read-only changes nothing; the Accountant
  // opens report pages only (PAGES below) and reads the change logs and reports.
  const GRANTS = Object.freeze({
    owner: Object.freeze(PERMISSIONS.slice()),
    admin: Object.freeze(PERMISSIONS.filter((p) => p !== 'account')),
    team: Object.freeze(['view', 'operate', 'personal', 'audit', 'reports']),
    readonly: Object.freeze(['view', 'personal', 'audit', 'reports']),
    accountant: Object.freeze(['view', 'audit', 'reports'])
  });

  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  function allows(role, permission) {
    if (role === 'investor') return permission === 'portal';
    if (!own(GRANTS, role) || PERMISSIONS.indexOf(permission) < 0) return false;
    return GRANTS[role].indexOf(permission) >= 0;
  }

  function permissionsOf(role) {
    return PERMISSIONS.filter((p) => allows(role, p));
  }

  // One row: Owner and Admin, Staff, Read-only, Accountant.
  const row = (lead, team, readonly, accountant) => Object.freeze({ owner: lead, admin: lead, team, readonly, accountant });
  const PAGES = Object.freeze({
    console: row('act', 'act', 'read', 'read'), // Overview
    'console-notifications': row('act', 'act', 'read', 'hidden'),
    'console-offerings': row('act', 'read', 'read', 'read'),
    'console-offering': row('act', 'read', 'read', 'read'), // one offering, opened from Offerings
    'console-intake': row('act', 'hidden', 'hidden', 'hidden'),
    'console-brand': row('act', 'hidden', 'hidden', 'hidden'),
    'console-integrations': row('act', 'hidden', 'hidden', 'hidden'),
    'console-ach': row('act', 'hidden', 'hidden', 'hidden'),
    'console-team': row('act', 'hidden', 'hidden', 'hidden'),
    'console-investors': row('act', 'act', 'read', 'read'),
    'console-esign': row('act', 'act', 'read', 'hidden'),
    'console-envelope': row('act', 'act', 'read', 'hidden'), // one envelope, opened from E-sign
    'console-notices': row('act', 'act', 'read', 'hidden'),
    'console-requests': row('act', 'act', 'read', 'hidden'),
    'console-kyc': row('act', 'act', 'read', 'hidden'),
    'console-calls': row('act', 'act', 'read', 'read'),
    'console-distributions': row('act', 'act', 'read', 'read'),
    'console-docs': row('act', 'act', 'read', 'read'),
    'console-taxdocs': row('act', 'act', 'read', 'read'),
    'console-books': row('act', 'act', 'read', 'read'), // Accounting (plan 11-13)
    'console-reports': row('act', 'act', 'read', 'read'), // its Investor reports tab (plan 12-06) is part of this page
    'console-audit': row('act', 'act', 'read', 'read'),
    'console-aml': row('act', 'read', 'read', 'hidden'),
    'console-filings': row('act', 'act', 'read', 'read'),
    'console-security': row('act', 'act', 'act', 'act') // Sign-in and security: one's own password, two-step and sessions
  });

  const DEFAULT_PAGES = Object.freeze([]);
  const DEFAULT_ACCESS = Object.freeze({ owner: 'act', admin: 'act', team: 'act', readonly: 'read', accountant: 'hidden' });

  function pageAccess(role, key) {
    if (!own(DEFAULT_ACCESS, role)) return 'hidden';
    return own(PAGES, key) ? PAGES[key][role] : DEFAULT_ACCESS[role];
  }

  const REFUSALS = Object.freeze({
    view: 'Your role does not open this page.',
    operate: 'Your role can look at this but not change it.',
    pay: 'Only an Admin or the Owner can change bank accounts or release payments.',
    spend: 'Only an Admin or the Owner can order anything that is charged to the firm.',
    configure: 'Only an Admin or the Owner can change this.',
    team: 'Only an Admin or the Owner can change the team.',
    account: 'Only the Owner can do this.',
    personal: 'Your role does not show investors’ personal details.',
    audit: 'Your role does not open the change log.',
    reports: 'Your role does not open reports.',
    never: 'This part of the portal cannot be changed this way.'
  });

  const API = Object.freeze({ ROLES, LABELS, LINES, PERMISSIONS, allows, permissionsOf, PAGES, DEFAULT_PAGES, pageAccess, REFUSALS });
  if (NS) NS.roles = API;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = API;
})(typeof window !== 'undefined' && window.CVPortal ? window.CVPortal : typeof globalThis !== 'undefined' && globalThis.CVPortal ? globalThis.CVPortal : null);
