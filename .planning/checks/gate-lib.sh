# Resumable gate steps, sourced by every gate (.planning/checks/gate-reference.sh, phase 8's checks/gate.sh, gate9.sh,
# gate10.sh, gate11.sh). A container restart in the middle of a gate run loses no finished step:
#
#   . .planning/checks/gate-lib.sh        (from the top of the checkout being judged)
#   gate_init <output folder>             stamps go to <output folder>/.gate-steps/; the tree judged is $PWD
#   FAIL=0
#   gate_step <id> <output file|-> [--base <commit>] -- <command...>
#   gate_ok '<label>' '<shell test>'      prints "GATE ok   <label>" or "GATE FAIL <label>" (FAIL=1); repeat as needed
#   gate_end ['<shell test>']             the step's result is final: its stamp is written (optional silent test: the
#                                         step only counts as passed when it holds too)
#   gate_run <id> <file> '<label>' '<test>' [--base <commit>] -- <command...>    the four above for a one-check step
#   gate_base_tree <folder> <commit>      git archive of <commit> into <folder>, kept while its stamp matches
#
# A step's stamp (<id>.stamp) holds the key it ran under - the checkout's folder, the HEAD commit, a hash of
# "git status --porcelain" + "git diff HEAD" + the untracked files' contents (gate-key.sh), the base commit when given,
# the command line and output file, and the content hash of every file outside the checkout the command names (and of
# each file in GATE_KEY_FILES) - then the time, "result ok|fail" and one line per check. It is written to a temporary
# name and renamed only once the step's output is complete and its checks are judged; it is removed when the step
# starts, so a step killed part-way is never taken as done.
#
# On a rerun into the same folder a step whose key matches exactly and whose stored result is ok is not run: each of
# its checks prints "GATE ok   <label> (kept from <time>)" (a step with no check prints "GATE ok   <id> (kept from ...)").
# A check whose test text changed since (an expected count given by the caller, say) is judged again on the kept
# output; if it then fails, the step's stamp is removed and the next run runs it. A failed step, or one whose key
# differs in any part, runs again. GATE_FRESH=1 runs every step. Nothing is kept when the tree has no key (not the
# top of a git checkout) or when the tree changed while the step ran.

GATE_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

gate_init() {
  GATE_STEPS="$1/.gate-steps"
  mkdir -p "$GATE_STEPS" || return 1
  GATE_TREE_DIR="$(pwd -P)"
  GATE_CUR=
}

gate_now() { date -u '+%Y-%m-%d %H:%M:%S UTC'; }
_gate_hash() { sha256sum | cut -c1-16; }
_gate_treekey() { bash "$GATE_LIB_DIR/gate-key.sh" "$GATE_TREE_DIR" 2>/dev/null; }

# Content hashes of the files outside the checkout that the command names (heavy.sh, measure.js, ...).
_gate_filekeys() {
  local a r
  for a in "$@" $GATE_KEY_FILES; do
    [ -f "$a" ] || continue
    r="$(readlink -f "$a")"
    case "$r" in "$GATE_TREE_DIR"/*) continue ;; esac
    echo "file $r $(sha256sum < "$r" | cut -c1-64)"
  done | sort -u
}

gate_step() {
  [ -n "$GATE_CUR" ] && gate_end
  local id="$1" out="$2"
  shift 2
  local base=-
  if [ "$1" = --base ]; then base="$2"; shift 2; fi
  [ "$1" = -- ] && shift
  GATE_CUR="$id"
  GATE_CUR_N=0
  GATE_CUR_BAD=0
  GATE_CUR_CHECKS=
  GATE_CUR_KEPT=0
  GATE_CUR_STAMP="$GATE_STEPS/$(printf '%s' "$id" | tr -c 'A-Za-z0-9._-' '_').stamp"
  local tk
  tk="$(_gate_treekey)"
  GATE_CUR_TREE="$tk"
  GATE_CUR_KEY=
  if [ -n "$tk" ]; then
    # one command substitution, so the key never ends in a newline (the stamp's copy is read back the same way)
    GATE_CUR_KEY="$(
      printf '%s\n' "$tk" "base $base" "cmd $(printf '%q ' "$@")" "out $out"
      _gate_filekeys "$@"
    )"
  fi
  if [ "${GATE_FRESH:-}" != 1 ] && [ -n "$GATE_CUR_KEY" ] && [ -f "$GATE_CUR_STAMP" ] \
    && [ "$(sed -n '/^key-begin$/,/^key-end$/p' "$GATE_CUR_STAMP" | sed '1d;$d')" = "$GATE_CUR_KEY" ] \
    && grep -qx 'result ok' "$GATE_CUR_STAMP"; then
    GATE_CUR_KEPT=1
    GATE_CUR_TIME="$(sed -n 's/^time //p' "$GATE_CUR_STAMP" | head -n 1)"
    return 0
  fi
  rm -f "$GATE_CUR_STAMP"
  if [ "$out" = - ]; then "$@"; else "$@" > "$out" 2>&1; fi
  return 0
}

gate_ok() {
  local label="$1" expr="$2" res eh stored
  if [ -z "$GATE_CUR" ]; then
    if eval "$expr"; then echo "GATE ok   $label"; return 0; fi
    echo "GATE FAIL $label"; FAIL=1; return 1
  fi
  GATE_CUR_N=$((GATE_CUR_N + 1))
  eh="$(printf '%s' "$expr" | _gate_hash)"
  if [ "$GATE_CUR_KEPT" = 1 ]; then
    stored="$(grep '^check ' "$GATE_CUR_STAMP" | sed -n "${GATE_CUR_N}p")"
    if [ "$(printf '%s' "$stored" | cut -d' ' -f3)" = "$eh" ] && [ "$(printf '%s' "$stored" | cut -d' ' -f2)" = ok ]; then
      res=ok
    elif eval "$expr"; then res=ok; else res=fail; fi
    if [ "$res" = ok ]; then echo "GATE ok   $label (kept from $GATE_CUR_TIME)"; return 0; fi
    echo "GATE FAIL $label"; FAIL=1; GATE_CUR_BAD=1; return 1
  fi
  if eval "$expr"; then res=ok; else res=fail; fi
  GATE_CUR_CHECKS="${GATE_CUR_CHECKS}check $res $eh $label
"
  if [ "$res" = ok ]; then echo "GATE ok   $label"; return 0; fi
  echo "GATE FAIL $label"; FAIL=1; GATE_CUR_BAD=1; return 1
}

gate_end() {
  [ -n "$GATE_CUR" ] || return 0
  local id="$GATE_CUR" res=ok tmp
  GATE_CUR=
  if [ "$GATE_CUR_KEPT" = 1 ]; then
    [ "$GATE_CUR_N" = 0 ] && echo "GATE ok   $id (kept from $GATE_CUR_TIME)"
    if [ "$GATE_CUR_BAD" = 1 ] || [ "$GATE_CUR_N" != "$(grep -c '^check ' "$GATE_CUR_STAMP")" ]; then rm -f "$GATE_CUR_STAMP"; fi
    return 0
  fi
  [ "$GATE_CUR_BAD" = 1 ] && res=fail
  if [ -n "$1" ] && ! eval "$1"; then res=fail; fi
  [ -n "$GATE_CUR_KEY" ] || return 0
  if [ "$(_gate_treekey)" != "$GATE_CUR_TREE" ]; then
    echo "GATE note: the tree changed while step $id ran; its result is not kept for a rerun"
    return 0
  fi
  tmp="$GATE_CUR_STAMP.part.$$"
  {
    echo key-begin
    printf '%s\n' "$GATE_CUR_KEY"
    echo key-end
    echo "time $(gate_now)"
    echo "result $res"
    printf '%s' "$GATE_CUR_CHECKS"
  } > "$tmp" && mv -f "$tmp" "$GATE_CUR_STAMP"
}

gate_tail() { echo "==> $1 <=="; tail -n 2 "$1" 2>/dev/null; echo; }

gate_run() {
  local id="$1" out="$2" label="$3" expr="$4"
  shift 4
  gate_step "$id" "$out" "$@"
  gate_tail "$out"
  gate_ok "$label" "$expr"
  gate_end
}

gate_base_tree() {
  local dir="$1" base="$2" stamp want
  stamp="$GATE_STEPS/tree-$(basename "$dir").stamp"
  want="base $(git rev-parse --verify -q "$base^{commit}" 2>/dev/null || echo "$base")
dir $dir"
  if [ "${GATE_FRESH:-}" != 1 ] && [ -d "$dir" ] && [ -f "$stamp" ] && [ "$(cat "$stamp")" = "$want" ]; then
    echo "base tree kept: $dir ($base)"
    return 0
  fi
  rm -f "$stamp"
  rm -rf "$dir" "$dir.part"
  mkdir -p "$dir.part" || return 1
  if git archive "$base" | tar -x -C "$dir.part"; then
    mv "$dir.part" "$dir" && printf '%s\n' "$want" > "$stamp.part.$$" && mv -f "$stamp.part.$$" "$stamp"
  else
    rm -rf "$dir.part"
    return 1
  fi
}
