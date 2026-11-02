#!/bin/sh
# experiments/LA-abs.sh <outdir> <seedFrom> <seedTo> [env...] — every hero's own-seat A/B, 4 at a time
out=$1; from=$2; to=$3; shift 3
mkdir -p "$out"
node -e 'console.log(require("./tools/selfplay.js").W.HEROES.map(h=>h.k).join("\n"))' | \
  xargs -P 4 -I{} sh -c "env $* node experiments/LA-ab.js {} $from $to > $out/{}.jsonl"
