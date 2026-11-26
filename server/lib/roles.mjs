// The console's permission table on the server (plan 15-12, SE-05): the browser's own assets/js/roles.js, loaded from
// the repository this server is deployed from, so the server and the screens can never disagree (15-RESEARCH
// Pitfall 4). Plan 15-05 adds the route table and the guard here.
import { createRequire } from 'node:module';

export const { ROLES, LABELS, LINES, PERMISSIONS, allows, permissionsOf, PAGES, DEFAULT_PAGES, pageAccess, REFUSALS } = createRequire(import.meta.url)('../../assets/js/roles.js');
