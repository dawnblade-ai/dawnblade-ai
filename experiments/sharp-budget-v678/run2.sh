#!/bin/bash
cd /home/user/dawnblade-ai
h=$1; arm=$2; out=/tmp/claude-0/-home-user-dawnblade-ai/fa3b2344-1f3c-53b3-b7f1-729f8e99311d/scratchpad/ab/$h.$arm$SFX.txt
case $arm in
  bo900) X="SPXLA_XH=$h SPXLA_XBO=900";;
  base78) X="";;
  blk450) X="SPXLA_XH=$h SPXLA_XB=450";;
esac
env TOURNEY_S0=$S0 SPXLA=all $X node tools/tourney.js $h '' 12 2>&1 | grep -E "^(GAMES|POLICY|WINS)" > $out
