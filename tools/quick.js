#!/usr/bin/env node
/* tools/quick.js — the FAST LANE for engine and UI work (2026-11-19). `npm run quick`.
   Runs every drill EXCEPT the server-referee family (test/server*.test.js, referee, wsreferee,
   hostref), which is ~60% of the suite's CPU and exercises the hosted table, not card rules.
   Prints only the summary and any `not ok` line. It is NOT the ship gate: `npm test` is
   (fail 0, skipped 5) — run it before any release, and always after touching server/,
   engine/wire.js, engine/net.js, engine/room.js, engine/hub.js or engine/lobby.js.
   `npm run quick -- <substring>` narrows to drill files whose name contains it. */
"use strict";
const fs = require("fs"), path = require("path"), {spawnSync} = require("child_process");
const SLOW = /^(server.*|referee|wsreferee|hostref)\.test\.js$/;
const want = process.argv[2] || "";
const dir = path.join(__dirname, "..", "test");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".test.js") && !SLOW.test(f) && f.includes(want))
  .sort().map(f => path.join("test", f));
if(!files.length){ console.log("no drill file name contains \"" + want + "\""); process.exit(1); }   /* node --test with no files runs EVERYTHING */
const t0 = Date.now();
const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap"].concat(files),
  {cwd: path.join(__dirname, ".."), encoding: "utf8", maxBuffer: 1 << 28});
const out = (r.stdout || "") + (r.stderr || "");
for(const l of out.split("\n")) if(/^# (tests|pass|fail|skipped) |^not ok /.test(l)) console.log(l);
console.log("# files " + files.length + " (server family skipped) · " + Math.round((Date.now() - t0) / 1000) + " s");
process.exit(r.status || 0);
