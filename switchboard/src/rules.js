// Mail rules: run on new mail as it arrives (and on demand over existing mail).
import { all, get, run, json, logActivity } from './db.js';
import { listAccounts, resolveAccount } from './accounts.js';
import * as store from './store.js';
import { events } from './bus.js';

const FIELDS = ['from', 'to', 'subject', 'body', 'any', 'has_attachment'];
const OPS = ['contains', 'not_contains', 'is', 'ends_with'];
const ACTIONS = ['move', 'mark_read', 'flag', 'archive', 'delete', 'forward'];

export function publicRule(r) {
  if (!r) return null;
  const acc = r.account_id ? listAccounts().find((a) => a.id === r.account_id) : null;
  return {
    id: r.id,
    name: r.name,
    enabled: !!r.enabled,
    accountId: r.account_id,
    account: acc ? acc.email : 'All accounts',
    match: r.match,
    conditions: json(r.conditions_json, []),
    actions: json(r.actions_json, []),
    stop: !!r.stop,
    timesApplied: r.times_applied,
    createdBy: r.created_by,
    summary: describeRule(r),
  };
}

export function describeRule(r) {
  const conds = json(r.conditions_json, []).map((c) => (c.field === 'has_attachment' ? 'it has an attachment' : `${c.field === 'any' ? 'the message' : c.field} ${String(c.op || 'contains').replace('_', ' ')} “${c.value}”`));
  const acts = json(r.actions_json, []).map((a) => ({ move: `move it to ${a.folder}`, mark_read: 'mark it read', flag: 'flag it', archive: 'archive it', delete: 'delete it', forward: `forward it to ${a.to}` })[a.type]);
  return `If ${conds.join(r.match === 'any' ? ' or ' : ' and ')}, ${acts.join(', ')}.`;
}

export function listRules() {
  return all('SELECT * FROM rules ORDER BY sort_order, id').map(publicRule);
}

function validate(input) {
  const conditions = (input.conditions || []).map((c) => ({ field: String(c.field || '').toLowerCase(), op: String(c.op || 'contains').toLowerCase(), value: c.value == null ? '' : String(c.value) }));
  const actions = (input.actions || []).map((a) => ({ type: String(a.type || '').toLowerCase(), ...(a.folder ? { folder: String(a.folder) } : {}), ...(a.to ? { to: String(a.to) } : {}) }));
  if (!conditions.length) throw new Error('A rule needs at least one condition.');
  if (!actions.length) throw new Error('A rule needs at least one action.');
  for (const c of conditions) {
    if (!FIELDS.includes(c.field)) throw new Error(`Condition field must be one of: ${FIELDS.join(', ')}.`);
    if (!OPS.includes(c.op)) throw new Error(`Condition op must be one of: ${OPS.join(', ')}.`);
    if (c.field !== 'has_attachment' && !c.value.trim()) throw new Error(`Give a value for the "${c.field}" condition.`);
  }
  for (const a of actions) {
    if (!ACTIONS.includes(a.type)) throw new Error(`Action must be one of: ${ACTIONS.join(', ')}.`);
    if (a.type === 'move' && !a.folder) throw new Error('Say which folder to move to.');
    if (a.type === 'forward' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.to || '')) throw new Error('Give an email address to forward to.');
  }
  return { conditions, actions };
}

export function saveRule(input, actor = 'you') {
  const { conditions, actions } = validate(input);
  const acc = input.accountId ? listAccounts().find((a) => a.id === Number(input.accountId)) : input.account ? resolveAccount(input.account) : null;
  if (input.account && !acc) throw new Error(`No account matches "${input.account}".`);
  const vals = [input.name || 'Rule', input.enabled === false ? 0 : 1, acc?.id || null, input.match === 'any' ? 'any' : 'all', JSON.stringify(conditions), JSON.stringify(actions), input.stop ? 1 : 0];
  let id = input.id ? Number(input.id) : null;
  if (id && get('SELECT id FROM rules WHERE id = ?', id)) run('UPDATE rules SET name=?, enabled=?, account_id=?, match=?, conditions_json=?, actions_json=?, stop=? WHERE id = ?', ...vals, id);
  else id = Number(run('INSERT INTO rules(name, enabled, account_id, match, conditions_json, actions_json, stop, created_by, sort_order) VALUES(?,?,?,?,?,?,?,?, (SELECT coalesce(max(sort_order),0)+1 FROM rules))', ...vals, actor).lastInsertRowid);
  const rule = publicRule(get('SELECT * FROM rules WHERE id = ?', id));
  logActivity(actor, input.id ? 'rule.update' : 'rule.create', `${rule.name}: ${rule.summary}`);
  return rule;
}

export function deleteRule(id, actor = 'you') {
  const r = get('SELECT * FROM rules WHERE id = ?', id);
  if (!r) throw new Error('Rule not found');
  run('DELETE FROM rules WHERE id = ?', id);
  logActivity(actor, 'rule.delete', r.name);
  return { deleted: r.name };
}

function textMatch(hay, c) {
  const h = String(hay || '').toLowerCase();
  const v = c.value.toLowerCase();
  if (c.op === 'is') return h.split(/[\s,<>]+/).includes(v) || h === v;
  if (c.op === 'ends_with') return h.split(/[\s,<>"]+/).some((x) => x.endsWith(v));
  if (c.op === 'not_contains') return !h.includes(v);
  return h.includes(v);
}

export function matches(rule, m) {
  const conds = json(rule.conditions_json, []);
  const test = (c) => {
    const from = `${m.from_name || ''} ${m.from_addr || ''}`;
    const to = `${m.to_json || ''} ${m.cc_json || ''}`;
    const body = m.body_text || m.snippet || '';
    switch (c.field) {
      case 'from': return textMatch(from, c);
      case 'to': return textMatch(to, c);
      case 'subject': return textMatch(m.subject, c);
      case 'body': return textMatch(body, c);
      case 'any': return textMatch(`${from} ${to} ${m.subject || ''} ${body}`, c);
      case 'has_attachment': return !!m.has_attachments;
      default: return false;
    }
  };
  return rule.match === 'any' ? conds.some(test) : conds.every(test);
}

async function folderFor(accountId, name) {
  const s = String(name).toLowerCase();
  const folders = store.foldersOf(accountId);
  let f = folders.find((x) => x.role === s) || folders.find((x) => x.name.toLowerCase() === s) || folders.find((x) => (x.path || '').toLowerCase() === s);
  if (!f) {
    const { createFolder } = await import('./mail.js');
    f = await createFolder(accountId, name);
  }
  return f;
}

/** Apply enabled rules, in order, to the given messages. Returns how many actions ran. */
export async function applyRules(messageIds, { onlyRuleId = null, actor = 'rules' } = {}) {
  const rules = all(`SELECT * FROM rules WHERE enabled = 1 ${onlyRuleId ? 'AND id = ?' : ''} ORDER BY sort_order, id`, ...(onlyRuleId ? [onlyRuleId] : []));
  if (!rules.length || !messageIds.length) return { applied: 0 };
  const mail = await import('./mail.js');
  const { ensureBody } = await import('./sync.js');
  const needsBody = rules.some((r) => json(r.conditions_json, []).some((c) => c.field === 'body' || c.field === 'any'));
  let applied = 0;
  for (const id of messageIds) {
    let m = store.messageRow(id);
    if (!m) continue;
    if (needsBody && m.body_state !== 1) m = (await ensureBody(id).catch(() => null)) || m;
    for (const rule of rules) {
      if (rule.account_id && rule.account_id !== m.account_id) continue;
      if (!matches(rule, m)) continue;
      let gone = false;
      // Flag/read/forward first; moving, archiving or deleting ends the message's stay in the inbox.
      const terminal = (a) => ['move', 'archive', 'delete'].includes(a.type);
      const ordered = json(rule.actions_json, []).sort((x, y) => terminal(x) - terminal(y));
      for (const a of ordered) {
        if (gone) break;
        try {
          if (a.type === 'mark_read') await mail.setFlags([id], { seen: true }, actor);
          else if (a.type === 'flag') await mail.setFlags([id], { flagged: true }, actor);
          else if (a.type === 'forward') await mail.sendMessage({ accountId: m.account_id, forwardId: id, to: a.to, skipContacts: true }, actor);
          else if (a.type === 'archive') { await mail.archiveMessages([id], actor); gone = true; }
          else if (a.type === 'delete') { await mail.deleteMessages([id], actor); gone = true; }
          else if (a.type === 'move') {
            const f = await folderFor(m.account_id, a.folder);
            if (f && f.id !== m.folder_id) { await mail.moveMessages([id], f.id, actor); gone = true; }
          }
          applied++;
        } catch (e) {
          logActivity(actor, 'rule.error', `${rule.name}: ${e.message}`);
        }
      }
      run('UPDATE rules SET times_applied = times_applied + 1 WHERE id = ?', rule.id);
      if (rule.stop || gone) break;
      m = store.messageRow(id) || m;
    }
  }
  if (applied) events.emit('mail', { rules: true });
  return { applied };
}

/** Run one rule (or all) over the inbox mail already downloaded. */
export async function runRulesNow({ ruleId = null, days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const ids = all("SELECT m.id FROM messages m JOIN folders f ON f.id = m.folder_id WHERE f.role = 'inbox' AND m.date >= ? ORDER BY m.date DESC", since).map((r) => r.id);
  const r = await applyRules(ids, { onlyRuleId: ruleId, actor: 'rules' });
  return { checked: ids.length, ...r };
}
