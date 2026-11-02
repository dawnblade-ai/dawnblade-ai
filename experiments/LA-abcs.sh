#!/bin/sh
# experiments/LA-abcs.sh <snapdir> <outdir> <seedFrom> <seedTo> base|trial [env...] — every hero, 4 at a time, from a frozen snapshot
snap=$1; out=$2; from=$3; to=$4; mode=$5; shift 5
mkdir -p "$out"
cd "$snap" && node -e 'console.log(require("./tools/selfplay.js").W.HEROES.map(h=>h.k).join("\n"))' | \
  xargs -P 4 -I{} sh -c "env $* node experiments/LA-abc.js {} $from $to $mode > $out/{}.jsonl"
