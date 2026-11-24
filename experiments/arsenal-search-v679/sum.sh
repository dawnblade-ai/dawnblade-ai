#!/bin/bash
# sum.sh arm [sfx]: arm vs v6.79 base (tgt) per hero
S=/tmp/claude-0/-home-user-dawnblade-ai/af28175c-f618-5e25-85a8-fa3c18c6a4ff/scratchpad; B=$S/base/experiments/search-shape-v678b
w(){ grep -oE "WINS: $1 [0-9]+|· $1 [0-9]+" $2 2>/dev/null | head -1 | grep -oE '[0-9]+$'; }
arm=$1; sfx=$2; tb=0; ta=0
for f in $S/ab/*.$arm$sfx.txt; do h=$(basename $f .$arm$sfx.txt); [ -s $f ] || continue
 b=$(w $h $B/$h.tgt$sfx.txt); a=$(w $h $f); tb=$((tb+b)); ta=$((ta+a))
 printf "%-10s base %3s  %s %3s  %+d   %s\n" $h $b $arm $a $((a-b)) "$(grep -o 'ARS.*' $f)"
done; echo "TOTAL base $tb $arm $ta ($((ta-tb)))"
grep -h REFUSALS $S/ab/*.$arm$sfx.txt | grep -vc "REFUSALS 0 · INVARIANT VIOLATIONS 0" | sed 's/^/runs with refusals or violations: /'
