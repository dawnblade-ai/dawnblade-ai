#!/bin/bash
# run.sh hero arm ENV=val ... (probe worktree)
cd /tmp/claude-0/-home-user-dawnblade-ai/af28175c-f618-5e25-85a8-fa3c18c6a4ff/scratchpad/wt; h=$1; arm=$2; shift 2; out=/tmp/claude-0/-home-user-dawnblade-ai/af28175c-f618-5e25-85a8-fa3c18c6a4ff/scratchpad/ab/$h.$arm$SFX.txt
[ -s $out ] && exit 0
env TOURNEY_S0=$S0 SPXLA=all "$@" node -r /tmp/claude-0/-home-user-dawnblade-ai/af28175c-f618-5e25-85a8-fa3c18c6a4ff/scratchpad/stats.js tools/tourney.js $h '' 12 2>&1 | grep -E "^(GAMES|POLICY|WINS|ARS)" > $out
