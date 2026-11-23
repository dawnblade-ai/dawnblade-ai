#!/bin/bash
# sum.sh arm [base-suffix]: per-hero wins vs v6.78 base78 (seeds 0-11)
S=/tmp/claude-0/-home-user-dawnblade-ai/7950bc58-db11-5363-add0-e7e000cf9e50/scratchpad; B=/tmp/claude-0/x/experiments/sharp-budget-v678
arm=$1; tb=0; ta=0
for f in $S/ab/*.$arm.txt; do [ -s $f ] || continue; h=$(basename $f .$arm.txt)
 a=$(grep -oE "WINS: $h [0-9]+|· $h [0-9]+" $f | head -1 | grep -oE '[0-9]+$'); b=$(grep -oE "WINS: $h [0-9]+" $B/$h.base78.txt | grep -oE '[0-9]+$')
 r=$(grep -oE "REFUSALS [0-9]+ · INVARIANT VIOLATIONS [0-9]+" $f | grep -oE '[0-9]+' | paste -sd/)
 printf "%-10s base %3d  %s %3d  %+d  (ref/viol %s)\n" $h $b $arm $a $((a-b)) $r; tb=$((tb+b)); ta=$((ta+a)); done
echo "TOTAL base $tb  $arm $ta  $((ta-tb))"
