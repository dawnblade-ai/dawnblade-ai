#!/bin/bash
# run.sh hero arm S0 [ENV=val ...]
S=/tmp/claude-0/-home-user-dawnblade-ai/dd3e5d68-91bf-5529-91dd-72812b78c011/scratchpad
cd $S/wt
h=$1; arm=$2; s0=$3; shift 3; out=$S/ab/$h.$arm.s$s0.txt
[ -s $out ] && exit 0
env TOURNEY_S0=$s0 SPXLA=all "$@" node tools/tourney.js $h '' 12 2>&1 | grep -E "^(GAMES|POLICY|WINS)" > $out
