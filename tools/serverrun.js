#!/usr/bin/env node
/* ============================================================
   tools/serverrun.js — THE REFEREE, PROVEN SERVER-SIDE (HIDDEN HANDS H3)

   HIDDEN-HANDS.md §6's H3 row: "the server suite runs test/ referee drills
   under Deno or Workers unchanged". No account, provider or key is needed
   for either half — both run on this machine:

   1. DENO (the runtime of Supabase Edge Functions). The referee drills, the
      SAME FILES `npm test` runs, under `deno test` with no edit:
        test/referee.test.js   test/hostref.test.js   test/judgetable.test.js
        test/wsreferee.test.js test/sha256.test.js    test/lobby.test.js
      Deno reads CommonJS with --unstable-detect-cjs and provides node:test.
      Point DENO at a binary (`npm install --prefix <scratch> deno` fetches
      one) or put `deno` on PATH; without one this half says SKIPPED, never
      passed.

   2. A WORKERS-SHAPED ISOLATE (test/helpers/isolate.js): web globals only —
      no window, document, require, process or Buffer — with the page's own
      scripts loaded as plain scripts and a Durable-Object-shaped table that
      takes WebSockets through net.wsAdapter(sock).accept(hub). Eight judged
      games, all fifteen heroes, both phones over sockets, scanned exactly as
      test/judgetable.test.js scans the in-process judge: each phone's view
      against the referee's view of that seat after every commit, every
      frame for hidden uids and the seed, and Verify on both phones.

       DENO=<path to deno> node tools/serverrun.js        both halves
       node tools/serverrun.js --isolate                  the isolate only
   Exits non-zero on any failure. A measuring drive, like twophone.js.
   ============================================================ */
const path = require("path");
const {spawnSync, execSync} = require("child_process");
const ROOT = path.join(__dirname, "..");
const DRILLS = ["test/referee.test.js", "test/hostref.test.js", "test/judgetable.test.js",
                "test/wsreferee.test.js", "test/sha256.test.js", "test/lobby.test.js"];
let failed = 0;

function denoBin(){
  if(process.env.DENO) return process.env.DENO;
  try { return execSync("command -v deno", {encoding: "utf8"}).trim() || null; } catch(_){ return null; }
}

if(process.argv.indexOf("--isolate") < 0){
  const deno = denoBin();
  if(!deno) console.log("DENO      SKIPPED — no deno binary (set DENO=…); this half did not run");
  else {
    const ver = spawnSync(deno, ["--version"], {encoding: "utf8"}).stdout.split("\n")[0];
    console.log("DENO      " + ver);
    for(const f of DRILLS){
      const t0 = Date.now();
      const r = spawnSync(deno, ["test", "--unstable-detect-cjs", "--allow-read", "--allow-env", "--allow-sys", "--no-check", f],
                          {cwd: ROOT, encoding: "utf8", maxBuffer: 64 << 20});
      const out = (r.stdout || "") + (r.stderr || "");
      const m = out.replace(/\x1b\[[0-9;]*m/g, "").match(/(ok|FAILED) \| (\d+) passed(?: \((\d+) steps?\))? \| (\d+) failed/);
      const ok = r.status === 0 && m && m[1] === "ok" && +m[4] === 0;
      if(!ok) failed++;
      console.log((ok ? "PASS  " : "FAIL  ") + f.padEnd(26) + (m ? m[2] + " passed, " + m[4] + " failed" : "no summary (exit " + r.status + ")") +
                  "  " + ((Date.now() - t0) / 1000).toFixed(0) + "s");
      if(!ok) console.log(out.split("\n").filter(l => /FAILED|error|Error/.test(l)).slice(0, 8).join("\n"));
    }
  }
}

/* ---- the isolate --------------------------------------------------------- */
const T = require("../test/helpers/judgetable.js");
const {makeIsolate} = require("../test/helpers/isolate.js");
const iso = makeIsolate();
const tables = new Map();
const makeHub = opts => { const t = new iso.TableObject({code: opts.code, build: opts.build, rand: opts.rand, resume: opts.resume, onEvent: opts.onEvent});
                          tables.set(t.hub, t); return t.hub; };
const accept = (hub, sock) => tables.get(hub).webSocket(sock);
const absent = Object.entries(iso.runtime).filter(([, v]) => v !== "undefined").map(([k]) => k);
console.log("ISOLATE   " + iso.scripts.length + " page scripts; absent: window document require module process Buffer global" +
            (absent.length ? "  — PRESENT: " + absent.join(" ") : ""));
if(absent.length) failed++;
const H = T.HEROES, pairs = [];
for(let i = 0; i < H.length; i += 2) pairs.push([H[i], H[(i + 1) % H.length]]);
pairs.forEach(([a, b], i) => {
  const t0 = Date.now();
  const r = T.judgedGame(a, b, "server-" + i, {ws: true, makeHub, accept});
  const verified = r.t.phones.map(p => { const rv = p.sess.revealed(); if(!rv) return false;
    return T.R.verifyGame({seedC: p.spec.seedC, seedG: p.spec.seedG, seedH: rv.seedH,
      start: sd => T.deal(p.spec.heroes[0], p.spec.heroes[1], sd, p.spec.first), reduce: T.J.reduce, seat: p.seat,
      log: rv.log, hashes: p.sess.hashes(), over: rv.over}).ok; });
  const ok = !!r.over && r.mism.join() === "0,0" && r.deep.join() === "0,0" && !r.leaks[0].length && !r.leaks[1].length &&
             !r.seedLeak && !r.earlyReveal && !r.judgeLeak && r.big <= 16384 && verified.every(Boolean) &&
             !r.t.hub.session().violations().length;
  if(!ok) failed++;
  console.log((ok ? "PASS  " : "FAIL  ") + (a + " v " + b).padEnd(22) + r.steps + " actions · views agree " + r.mism.map(x => x === 0).join("/") +
              " · leaks " + r.leaks[0].length + "/" + r.leaks[1].length + " · largest frame " + r.big + " · verified " + verified.join("/") +
              " · " + r.t.sockets + " socket frames · " + ((Date.now() - t0) / 1000).toFixed(0) + "s");
});
console.log(failed ? "FAILED: " + failed : "ALL PASS");
process.exit(failed ? 1 : 0);
