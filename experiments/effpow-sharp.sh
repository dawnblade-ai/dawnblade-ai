#!/bin/sh
# effpow-allab.sh <outdir> <from> <to> [heroes...] : per hero, own-seat SPXEFFPOW none vs on (rule policy)
cd "$(dirname "$0")/.." || exit 1
out=$1; from=$2; to=$3; shift 3
mkdir -p "$out"
heroes=${*:-$(node -e 'console.log(require("./tools/selfplay.js").W.HEROES.map(h=>h.k).join(" "))')}
for h in $heroes; do echo $h; done | \
  xargs -P ${JOBS:-4} -I{} sh -c "SEARCH=1 SPXEFFPOW=none node experiments/LA-ab.js {} $from $to off > $out/{}.off.jsonl; SEARCH=1 SPXEFFPOW={} node experiments/LA-ab.js {} $from $to off > $out/{}.on.jsonl"
echo done > "$out/DONE"
