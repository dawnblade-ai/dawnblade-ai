#!/bin/bash
# sweep.sh S0 : probe arm over all heroes, 4 parallel (base repro already running separately)
cd "$(dirname "$0")"
for h in $(cat heroes.txt); do echo "$h"; done | xargs -P 4 -I{} ./run.sh {} pay $1 SPXLA_PAY={}
