#!/bin/bash
# sum2.sh: seeds 12-23, every arm vs base78.s2, plus both-samples totals
S=/tmp/claude-0/-home-user-dawnblade-ai/7950bc58-db11-5363-add0-e7e000cf9e50/scratchpad; B=/tmp/claude-0/x/experiments/sharp-budget-v678
w(){ grep -oE "WINS: $1 [0-9]+|· $1 [0-9]+" $2 2>/dev/null | head -1 | grep -oE '[0-9]+$'; }
printf "%-10s %5s %5s %5s %5s | 24-seed: %s\n" hero base mu2 tgt gw1 "base mu2 tgt gw1"
declare -A T
for f in $S/ab/*.base78.s2.txt; do h=$(basename $f .base78.s2.txt); [ -s $f ] || continue
 b=$(w $h $f); m=$(w $h $S/ab/$h.mu2.s2.txt); t=$(w $h $S/ab/$h.tgt.s2.txt); g=$(w $h $S/ab/$h.gw1.s2.txt)
 b1=$(w $h $B/$h.base78.txt); m1=$(w $h $S/ab/$h.mu2.txt); t1=$(w $h $S/ab/$h.tgt.txt); g1=$(w $h $S/ab/$h.gw1.txt)
 printf "%-10s %5s %5s %5s %5s | %s %s %s %s\n" $h "$b" "$m" "$t" "$g" $((b+b1)) $((${m:-0}+m1)) $((${t:-0}+t1)) $((${g:-0}+g1))
done
grep -h "REFUSALS" $S/ab/*.s2.txt | grep -vc "REFUSALS 0 · INVARIANT VIOLATIONS 0" | sed 's/^/runs with refusals or violations: /'
