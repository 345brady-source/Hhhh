#!/usr/bin/env bash
# The tree key a gate step or a check part runs under, one line per part, on standard output:
#   root <the checkout's folder>
#   head <the HEAD commit>
#   tree <sha256 of "git status --porcelain" + "git diff HEAD --binary" + every untracked file's content>
#   bash .planning/checks/gate-key.sh <folder>
# The folder must be the top of a git checkout (a base tree made by git archive, or a folder inside some other
# repository, has no key: exit 1 and nothing printed, so nothing is ever kept for it). The tree line changes with any
# uncommitted edit, also one that leaves "git status --porcelain" the same (a second edit of an already modified file).
# Ignored files (server/node_modules, server/data) are not part of the key.
D="${1:-.}"
D="$(cd "$D" 2>/dev/null && pwd -P)" || exit 1
TOP="$(git -C "$D" rev-parse --show-toplevel 2>/dev/null)" || exit 1
TOP="$(cd "$TOP" && pwd -P)" || exit 1
[ "$TOP" = "$D" ] || exit 1
HEADC="$(git -C "$D" rev-parse --verify -q HEAD)" || exit 1
TREE="$(
  cd "$D" || exit 1
  echo "status"
  git status --porcelain=v1 -uall || exit 1
  echo "diff"
  git diff HEAD --binary || exit 1
  echo "untracked"
  git ls-files --others --exclude-standard -z | while IFS= read -r -d '' f; do
    printf '%s %s\n' "$(git hash-object -- "$f" 2>/dev/null || echo unreadable)" "$f"
  done
)" || exit 1
echo "root $D"
echo "head $HEADC"
echo "tree $(printf '%s' "$TREE" | sha256sum | cut -c1-64)"
