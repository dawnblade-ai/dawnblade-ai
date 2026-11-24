#!/bin/bash
# sum.sh S0 : probe vs stored tgt base for that sample
S=/tmp/claude-0/-home-user-dawnblade-ai/dd3e5d68-91bf-5529-91dd-72812b78c011/scratchpad; R=/home/user/dawnblade-ai
sfx=""; [ "$1" = 12 ] && sfx=".s2"
w(){ grep -oE "WINS: $1 [0-9]+|· $1 [0-9]+" | head -1 | grep -oE '[0-9]+$'; }
tb=0; tp=0
for h in $(cat $S/heroes.txt); do
 b=$(git -C $R show origin/findings/queue:experiments/search-shape-v678b/$h.tgt$sfx.txt | w $h); p=$(w $h < $S/ab/$h.pay.s$1.txt)
 printf "%-10s base %3s pay %3s  %+d\n" $h $b $p $((p-b)); tb=$((tb+b)); tp=$((tp+p)); done
echo "TOTAL base $tb pay $tp  $((tp-tb))"
grep -h REFUSALS $S/ab/*.pay.s$1.txt | grep -vc "REFUSALS 0 · INVARIANT VIOLATIONS 0" | sed 's/^/runs with refusals or violations: /'
