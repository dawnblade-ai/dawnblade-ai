#!/usr/bin/env node
/* ============================================================
   npm run scenes            every hero
   npm run scenes azalea     one hero, or any name fragment

   THE REPORT. `test/scenes.test.js` runs the same scenes as drills, so a
   green suite and a green report cannot disagree — one copy of the scenes,
   two readers (tools/scenes/*.js).

   What it is FOR: answering "does Azalea work" without reading code. The
   drills in `test/` are organised per MECHANIC, which is right for building
   a reader and useless for that question.
   ============================================================ */
const R = require("./scenes/runner.js");

const A = process.argv.slice(2).filter(x => x[0] !== "-");
const VERBOSE = process.argv.includes("--all");
const JSONOUT = process.argv.includes("--json");

if(!R.hasDb()){
  console.log("\n  no cached card database — run: node tools/audit.js\n");
  process.exit(0);
}

const results = R.runAll(A[0]);
if(!results.length){
  console.log("\n  no scenes match " + JSON.stringify(A[0]) + "\n");
  process.exit(0);
}

if(JSONOUT){
  console.log(JSON.stringify(results.map(r => ({
    hero: r.scene.hero, name: r.scene.name, ok: r.ok, threw: r.threw || null,
    checks: r.checks.map(c => ({what: c.k, want: c.want, have: c.have, ok: c.ok}))
  })), null, 1));
  process.exit(results.every(r => r.ok) ? 0 : 1);
}

const B = s => "\x1b[1m" + s + "\x1b[0m";
const DIM = s => "\x1b[2m" + s + "\x1b[0m";
const RED = s => "\x1b[31m" + s + "\x1b[0m";
const GRN = s => "\x1b[32m" + s + "\x1b[0m";

console.log("\n" + B("SCENES") + " — does the card DO what it prints?");
console.log(DIM("  the audit asks whether the text was READ. this asks whether the"));
console.log(DIM("  reading was OBEYED — see FINISH.md §0.\n"));

const byHero = new Map();
for(const r of results){
  if(!byHero.has(r.scene.hero)) byHero.set(r.scene.hero, []);
  byHero.get(r.scene.hero).push(r);
}

let pass = 0, fail = 0;
for(const [hero, rs] of byHero){
  const ok = rs.filter(r => r.ok).length;
  const head = "  " + B(hero.padEnd(12)) + " " + ok + "/" + rs.length;
  console.log(ok === rs.length ? head + "  " + GRN("✓") : head + "  " + RED("✗"));
  for(const r of rs){
    r.ok ? pass++ : fail++;
    if(r.ok && !VERBOSE) continue;
    console.log("     " + (r.ok ? GRN("ok  ") : RED("FAIL")) + " " + r.scene.name);
    if(r.threw) console.log("          " + RED("threw: " + r.threw));
    for(const ch of r.checks){
      if(ch.ok && !VERBOSE) continue;
      const line = "          " + ch.k + ": " + JSON.stringify(ch.have)
                 + DIM("  (want " + JSON.stringify(ch.want) + ")");
      console.log(ch.ok ? DIM(line) : RED(line));
    }
    if(!r.ok && r.scene.why){
      console.log(DIM("          why this scene exists:"));
      for(const l of wrap(r.scene.why, 68)) console.log(DIM("            " + l));
    }
  }
}

function wrap(s, n){
  const out = []; let line = "";
  for(const w of String(s).split(/\s+/)){
    if((line + " " + w).trim().length > n){ out.push(line.trim()); line = w; }
    else line += " " + w;
  }
  if(line.trim()) out.push(line.trim());
  return out;
}

console.log("\n  " + pass + " passing · " + (fail ? RED(fail + " FAILING") : "0 failing")
  + DIM("   ·  --all to see every observation") + "\n");
process.exit(fail ? 1 : 0);
