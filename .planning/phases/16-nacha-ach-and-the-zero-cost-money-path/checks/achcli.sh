#!/usr/bin/env bash
# The independent NACHA reader for phase 16's checks (test-only; never shipped): moov-io/ach achcli v1.69.1
# (Apache-2.0), had by exact version through Go's checksum database and accepted only with the pinned module hash.
# Every phase 16 check reaches the reader through this file and nothing else.
#
#   bash achcli.sh --path      the absolute path of a verified binary (exit 0); otherwise one line and a non-zero exit:
#                              "SKIP independent reader: <why>. Install line: <the go install line>"   (exit 3) or
#                              "FAIL independent reader: <path> is not moov-io/ach v1.69.1 with the pinned module hash" (exit 4)
#   bash achcli.sh --mod-line  the verified binary's module line from `go version -m`
#   bash achcli.sh <args>      runs the verified binary with achcli's own arguments (-validate-file, -validate-totals, -mask)
#
# Where: $ACHCLI when set; else ${ACHCLI_HOME:-$HOME/.cache/cv-checks/achcli-v1.69.1}/achcli, outside the repository
# and the scratchpad (a scratchpad wipe loses nothing that cannot be downloaded again). A missing binary in that folder is
# installed there with GOFLAGS=-mod=mod GOBIN=<that folder>. The install is refused when the checksum database could not
# vouch for the module: GOSUMDB off, GOFLAGS holding -insecure, or GONOSUMDB, GONOSUMCHECK, GOPRIVATE or GOINSECURE
# matching github.com/moov-io/ach. The first install may fetch the Go toolchain the module asks for (go.mod: go 1.26.0)
# through the proxy; after that it runs with no network.
# Verified means: `go version -m <binary>` holds the tab-separated line mod, github.com/moov-io/ach, v1.69.1, and the
# pinned module hash below. A SKIP is a failure everywhere: no phase 16 check prints PASS without the reader.
set -u
MODULE=github.com/moov-io/ach
VERSION=v1.69.1
HASH='h1:v+nHTd9qN4vYBmp+4mRf+8E/yztxoxxUtgMxgTGGtbo='
DIR="${ACHCLI_HOME:-$HOME/.cache/cv-checks/achcli-$VERSION}"
INSTALL="GOFLAGS=-mod=mod GOBIN=$DIR go install $MODULE/cmd/achcli@$VERSION"

skip() { echo "SKIP independent reader: $1. Install line: $INSTALL"; exit 3; }

# The binary's module line, read with the go command outside any module (no go.mod of a working folder applies).
mod_line() { (cd / && go version -m "$1" 2>/dev/null) | awk -F'\t' -v m="$MODULE" -v v="$VERSION" -v h="$HASH" '$2 == "mod" && $3 == m && $4 == v && $5 == h { print; n++ } END { exit n == 1 ? 0 : 1 }'; }

# 0 when a comma-separated list of Go module path patterns (GONOSUMDB and the like) matches the module.
matches_module() {
  local pat n prefix IFS=,
  for pat in $1; do
    [ -n "$pat" ] || continue
    n=$(printf '%s' "$pat" | awk -F/ '{ print NF }')
    prefix=$(printf '%s' "$MODULE" | cut -d/ -f1-"$n")
    # shellcheck disable=SC2053
    [[ "$prefix" == $pat ]] && return 0
  done
  return 1
}

install() {
  local v tmp
  v=$(cd / && go env GOSUMDB 2>/dev/null)
  case "$v" in off | '') skip "the install is refused: the checksum database is turned off (GOSUMDB=${v:-empty}), so nothing vouches for the module" ;; esac
  v=$(cd / && go env GOFLAGS 2>/dev/null)
  case " $v " in *-insecure*) skip "the install is refused: GOFLAGS holds -insecure" ;; esac
  for name in GONOSUMDB GONOSUMCHECK GOPRIVATE GOINSECURE; do
    v=$(cd / && go env "$name" 2>/dev/null)
    [ -n "$v" ] || v="${!name:-}"
    if matches_module "$v"; then skip "the install is refused: $name ($v) takes $MODULE out of the checksum database"; fi
  done
  mkdir -p "$DIR" || skip "the folder $DIR cannot be created"
  tmp=$(mktemp -d "$DIR/.install.XXXXXX") || skip "no temporary folder in $DIR"
  if ! (cd / && GOFLAGS=-mod=mod GOBIN="$tmp" go install "$MODULE/cmd/achcli@$VERSION") > "$DIR/install.log" 2>&1; then
    rm -rf "$tmp"
    skip "the install failed (no network and no cached module, or a refused checksum; see $DIR/install.log)"
  fi
  # Moved into place in one step, so a check running at the same time never sees half a binary.
  mv -f "$tmp/achcli" "$DIR/achcli" && rm -rf "$tmp" || { rm -rf "$tmp"; skip "the installed binary could not be moved to $DIR/achcli"; }
}

reader() { # prints the verified binary's path, or the SKIP/FAIL line and exits
  local bin
  if [ -n "${ACHCLI:-}" ]; then
    bin="$ACHCLI"
    [ -f "$bin" ] && [ -x "$bin" ] || skip "ACHCLI=$bin is not an executable file"
    command -v go > /dev/null 2>&1 || skip "no go command on PATH, so $bin cannot be checked against the pinned module hash"
  else
    bin="$DIR/achcli"
    command -v go > /dev/null 2>&1 || skip "no go command on PATH"
    [ -x "$bin" ] || install
  fi
  bin=$(readlink -f "$bin")
  if ! mod_line "$bin" > /dev/null; then
    echo "FAIL independent reader: $bin is not moov-io/ach $VERSION with the pinned module hash"
    exit 4
  fi
  printf '%s\n' "$bin"
}

case "${1:-}" in
  --path) reader ;;
  --mod-line)
    BIN=$(reader)
    RC=$?
    [ "$RC" = 0 ] || { printf '%s\n' "$BIN"; exit "$RC"; }
    mod_line "$BIN"
    ;;
  '') echo "FAIL achcli.sh: no argument (--path, --mod-line or achcli's own arguments)"; exit 2 ;;
  *)
    BIN=$(reader)
    RC=$?
    [ "$RC" = 0 ] || { printf '%s\n' "$BIN"; exit "$RC"; }
    exec "$BIN" "$@"
    ;;
esac
