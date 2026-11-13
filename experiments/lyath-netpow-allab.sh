#!/bin/sh
# allab.sh <outdir> <from> <to> : per hero, own-seat net-power gate none vs on
cd /home/user/dawnblade-ai/.claude/worktrees/agent-a3cc10a561f865a0c
out=$1; from=$2; to=$3
mkdir -p $out
node -e 'console.log(require("./tools/selfplay.js").W.HEROES.map(h=>h.k).join("\n"))' | \
  xargs -P 6 -I{} sh -c "SPXNETPOW=none node experiments/LA-ab.js {} $from $to off > $out/{}.off.jsonl; SPXNETPOW={} node experiments/LA-ab.js {} $from $to off > $out/{}.on.jsonl"
echo done > $out/DONE
