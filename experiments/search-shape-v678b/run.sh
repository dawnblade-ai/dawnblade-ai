#!/bin/bash
# usage: run.sh hero arm "XSET"
cd /tmp/claude-0/-home-user-dawnblade-ai/7950bc58-db11-5363-add0-e7e000cf9e50/scratchpad/wt
S=/tmp/claude-0/-home-user-dawnblade-ai/7950bc58-db11-5363-add0-e7e000cf9e50/scratchpad
h=$1; arm=$2; set=$3; out=$S/ab/$h.$arm$SFX.txt
env TOURNEY_S0=$S0 SPXLA=all SPXLA_XH=$h SPXLA_XSET="$set" node tools/tourney.js $h '' 12 2>&1 | grep -E "^(GAMES|POLICY|WINS)" > $out
