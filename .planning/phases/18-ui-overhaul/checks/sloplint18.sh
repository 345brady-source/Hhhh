#!/usr/bin/env bash
# sloplint judged on one plan's own stylesheets and DOMs (plan 18-02; a helper, not a gate check).
#   bash sloplint18.sh <out dir> <dom dir or -> <own stylesheet>...
# Runs the Hallmark sloplint over the DOM captures (<dom dir>/*.html, when given) and every stylesheet in assets/css, so a
# stylesheet with no Hallmark line of its own takes base.css's stamp, as it does in the product. Output: <out>/sloplint.txt.
# Then it judges only the sections of the named stylesheets (by base name) and of the DOM files:
#   - an own-stylesheet argument may carry a scope, for a stylesheet several plans share: name.css=<regex> judges only the
#     findings whose selector (the text after " on " in the finding) matches; name.css!=<regex> judges all findings but
#     those; a finding that names no selector is judged whenever its stylesheet is;
#   - every judged FAIL line must be one of the stamped conflicts with owner decisions D-02 and D-14 (base.css lines 6-8):
#     FAIL 19 ... dash, FAIL 67 ... AML/KYC, FAIL 63 ... " · ", FAIL 9 ... Ysabeau SC;
#   - no judged REFLEX line may remain, with one stamped exception: REFLEX 37 (the family count) when its families are
#     exactly Brygada 1918, Ysabeau Office, Ysabeau SC and Caveat and base.css carries the line "Hallmark · conflict 37"
#     naming D-14. sloplint's waiver guard for 37 counts the generic --font-mono (ui-monospace) as a fifth family, so a
#     waiver of 37 is refused although the gate itself counts four; the conflict line records the owner's decision instead.
# Findings in other stylesheets are printed under "NOTE not judged:" for the plan that owns them.
# Last line: "SLOPLINT18: PASS (judged: <names>)" (exit 0) or "SLOPLINT18: FAIL (<count> lines)" (exit 1).
set -u
OUT="${1:?out dir}"
DOMS="${2:?dom dir or -}"
shift 2
[ $# -ge 1 ] || { echo "SLOPLINT18: FAIL (no own stylesheet named)"; exit 1; }
LINT=/root/.claude/skills/hallmark/scripts/sloplint.mjs
mkdir -p "$OUT"
HTML=()
if [ "$DOMS" != "-" ]; then
  for f in "$DOMS"/*.html; do [ -f "$f" ] && HTML+=("$f"); done
  [ ${#HTML[@]} -gt 0 ] || { echo "SLOPLINT18: FAIL (no DOM capture in $DOMS)"; exit 1; }
fi
node "$LINT" ${HTML[@]+"${HTML[@]}"} assets/css/*.css --genre modern-minimal --scope app > "$OUT/sloplint.txt" 2>&1
SUMMARY=$(grep -E '^sloplint: .* across [0-9]+ file\(s\)\.$' "$OUT/sloplint.txt" | tail -n 1)
if [ -z "$SUMMARY" ]; then
  echo "FAIL sloplint did not finish (no summary line); see $OUT/sloplint.txt"
  echo "SLOPLINT18: FAIL (1 lines)"
  exit 1
fi
echo "$SUMMARY"
C37=0
grep -Eq 'Hallmark · conflict 37 .*D-14' assets/css/base.css && C37=1
DOMLIST=""
for f in ${HTML[@]+"${HTML[@]}"}; do DOMLIST="$DOMLIST$(basename "$f")"$'\n'; done
SPECS="$(printf '%s\n' "$@")" DOMLIST="$DOMLIST" C37="$C37" node - "$OUT/sloplint.txt" <<'NODE'
const fs = require('fs');
const path = require('path');
const file = process.argv[2];
const specs = process.env.SPECS.split('\n').filter(Boolean);
const doms = process.env.DOMLIST.split('\n').filter(Boolean);
const own = specs.map((s) => {
  const m = /^([^=!]+?)(!?=)(.*)$/.exec(s);
  return m ? { name: path.basename(m[1]), mode: m[2], re: new RegExp(m[3]) } : { name: path.basename(s), mode: '', re: null };
});
const ALLOWED = /FAIL 19 .*dash|FAIL 67 .*AML\/KYC|FAIL 63 .* · |FAIL 9 .*Ysabeau SC/;
const stamped37 = (t) => {
  const m = /^REFLEX 37 \S+ \d+ font families: (.*?)( \| fix:|$)/.exec(t);
  if (!m || process.env.C37 !== '1') return false;
  const fams = m[1].split(',').map((x) => x.trim().toLowerCase()).sort();
  return JSON.stringify(fams) === JSON.stringify(['brygada 1918', 'caveat', 'ysabeau office', 'ysabeau sc']);
};
let section = '';
const bad = [];
const notJudged = [];
for (const l of fs.readFileSync(file, 'utf8').split('\n')) {
  if (/^\S/.test(l) && !/^sloplint:/.test(l)) {
    section = l.trim();
    continue;
  }
  if (!/^\s+(FAIL|REFLEX|WARN|WAIVED|WAIVER|ANSWERED|DISMISSED|NOTE)\b/.test(l)) continue;
  const base = path.basename(section);
  const o = own.find((x) => x.name === base);
  if (!o && !doms.includes(base)) {
    if (/^\s+(FAIL|REFLEX|WAIVER)\b/.test(l)) notJudged.push(`${section}: ${l.trim()}`);
    continue;
  }
  if (o && o.re) {
    const sel = (/ on (.+?)( \| fix:|$)/.exec(l) || [])[1];
    if (sel !== undefined) {
      const hit = o.re.test(sel);
      if ((o.mode === '=' && !hit) || (o.mode === '!=' && hit)) continue;
    }
  }
  const t = l.trim();
  if (/^FAIL\b/.test(t) && !ALLOWED.test(t)) bad.push(`${section}: ${t}`);
  if (/^REFLEX\b/.test(t)) {
    if (stamped37(t)) console.log(`NOTE accepted (stamped conflict 37 with D-14 in base.css): ${section}: ${t}`);
    else bad.push(`${section}: ${t}`);
  }
}
for (const n of notJudged) console.log(`NOTE not judged: ${n}`);
for (const b of bad) console.log(`FAIL ${b}`);
const names = own.map((o) => o.name).concat(doms).join(', ');
console.log(bad.length ? `SLOPLINT18: FAIL (${bad.length} lines)` : `SLOPLINT18: PASS (judged: ${names})`);
process.exit(bad.length ? 1 : 0);
NODE
