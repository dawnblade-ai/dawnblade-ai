#!/bin/sh
# The dead-tap sweep over all fifteen heroes (v4.88). A hero whose opening
# never reached the reaction window is retried up to three times: the deal is
# seeded per match, and some openings hold no affordable attack.
#
#   NODE_PATH="$SCRATCH/node_modules" sh tools/phone/sweep.sh [outdir]
#
# Prints one block per hero; anything but `ok` lines and `ERRS []` is a lead.
D=$(cd "$(dirname "$0")" && pwd)
OUT=${1:-${TMPDIR:-/tmp}/deadtap}
mkdir -p "$OUT"
for h in Arakni Azalea Blaze Boltyn Bravo Briar Dash Dorinthea Enigma Fai Gravy Iyslander Kayo Lyath Viserai; do
  for try in 1 2 3; do
    timeout 200 node "$D/deadtap.js" "$h" > "$OUT/$h.out" 2>&1
    if grep -q "stack " "$OUT/$h.out"; then break; fi
  done
  # anchored: a refusal's own prose can say "before" (v4.89)
  echo "== $h"; grep -E "^(DEAD|NOSTACK|NOACT|NOATTACK|ERRS)|^   (before|after)" "$OUT/$h.out" | cut -c1-600
done
