#!/usr/bin/env bash
# Runs one heavy command (a browser check, a word-processor conversion, a page render) in one of three slots,
# so many executors on a four-core machine do not starve each other into false timeouts.
# Usage: heavy.sh <command> [args...]
L="$(dirname "$0")/locks"; mkdir -p "$L"
while :; do
  for i in 1 2 3; do
    exec {fd}>"$L/slot$i"
    if flock -n "$fd"; then "$@"; rc=$?; flock -u "$fd"; exit $rc; fi
    exec {fd}>&-
  done
  sleep 2
done
