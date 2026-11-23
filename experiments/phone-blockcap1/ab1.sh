#!/bin/bash
cd /home/user/dawnblade-ai
SEEDS=${SEEDS:-12}; O=/tmp/claude-0/-home-user-dawnblade-ai/77931582-843d-5ebf-bd57-10d70f5048da/scratchpad/ab1; export O
run(){ h=$1; arm=$2; seat=$3
  if [ $seat = A ]; then a=$h; b=''; else a=''; b=$h; fi
  if [ $arm = none ]; then export SPXBLOCKCAP1=none; fi
  SPXLA=$h node tools/tourney.js "$a" "$b" $SEEDS > $O/$h-$arm-$seat.txt 2>&1; }
export -f run
for h in azalea prism boltyn viseraibw fai; do for arm in none on; do for seat in A B; do echo "$h $arm $seat"; done; done; done | xargs -P4 -L1 bash -c 'run $0 $1 $2'
