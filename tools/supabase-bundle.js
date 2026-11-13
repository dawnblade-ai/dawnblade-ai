#!/usr/bin/env node
/* ============================================================
   tools/supabase-bundle.js — CUT THE HOSTED REFEREE'S DEPLOY FOLDER (SERVER S3)

   Plain Node, zero dependencies, no build step in the repo's sense: it COPIES the engine files the referee loads
   (and wraps two of them) next to a generated Deno entry. Nothing it writes is tracked — the output folder is
   git-ignored — and nothing it writes is hand-edited.

     node tools/supabase-bundle.js                 write server/supabase/dist/ and print the build id and sizes
     node tools/supabase-bundle.js --check         exit 1 when anything built from an older tree is STALE
     node tools/supabase-bundle.js --stamp         record what was just deployed in server/supabase/DEPLOYED.json
                                                   (tracked; run it after a deploy, commit it)
     node tools/supabase-bundle.js --out <dir>     write somewhere else

   WHAT COMES OUT (dist/)
     supabase/config.toml                      a one-function project: [functions.table] verify_jwt = false
     supabase/functions/table/index.ts         the Deno entry (server/supabase/entry.template.ts + the load list)
     supabase/functions/table/src/engine/*.js  STRAIGHT COPIES of the engine files the referee loads, in load order
     supabase/functions/table/src/server/referee.js   a straight copy of server/referee.js
     supabase/functions/table/src/data/pool.ts        data/pool.js, byte for byte, inside `export default function(window){…}`
     supabase/functions/table/src/data/page-data.ts   index.html's data script (APP_VER, DATA_VER, CDN, HEROES, DECKS), same wrapping
     table.single.ts                           ONE self-contained file: the same code inline, for pasting into the dashboard
     BUNDLE.json                               build id, digest, every file's size and sha256

   WHY NO eval: Supabase's edge runtime may refuse code generation from strings (UNVERIFIED either way), so the
   engine is loaded by static `import` (folder) or inline function wrappers (single file) — never eval/new Function.
   The engine files are UMD scripts; imported as ES modules they attach to `self` exactly as in the browser
   (rehearsed under Deno: tools/supabase-rehearse.js).

   THE BUILD ID the handshake needs (DawnLobby.buildId(APP_VER, DATA_VER)) is computed at run time inside the
   function from the page data it carries; `--check` fails when the tree's source no longer matches what was cut or
   deployed, so a page release without a redeploy cannot go unnoticed (the digest covers every file loaded).
   ============================================================ */
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
const TEMPLATE = path.join(ROOT, "server", "supabase", "entry.template.ts");
const STAMP = path.join(ROOT, "server", "supabase", "DEPLOYED.json");
const DEFAULT_OUT = path.join(ROOT, "server", "supabase", "dist");
const FN = "table";
/* the page's scripts the referee does NOT need: the AI seat, the local table, the PeerJS room, the phone's own channel
   to this function, the bug-report builder */
const NOT_NEEDED = new Set(["engine/sparring.js", "engine/local.js", "engine/room.js", "engine/servertable.js", "engine/report.js"]);

const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");

/* the page's own script order (index.html), engine/ and data/ only — what the isolate drills load */
function pageScripts(){
  return [...read("index.html").matchAll(/<script src="((?:engine|data)\/[a-z0-9]+\.js)"/g)].map(m => m[1]);
}
/* index.html's data script, exactly as test/helpers/isolate.js slices it */
function dataScript(){
  const html = read("index.html"), start = html.indexOf("window.CDN");
  return html.slice(start, html.indexOf("</script>", start));
}
const q = s => JSON.stringify(s);

function cut(){
  const all = pageScripts();
  const poolPath = "data/pool.js";
  if(all.indexOf(poolPath) < 0) throw new Error("index.html does not load data/pool.js");
  const engine = all.filter(f => f.startsWith("engine/") && !NOT_NEEDED.has(f));
  for(const must of ["engine/hub.js", "engine/judge.js", "engine/build.js", "engine/cards.js", "engine/wire.js", "engine/sha256.js", "engine/invariants.js", "engine/effects.js", "engine/lobby.js"])
    if(engine.indexOf(must) < 0) throw new Error("the page no longer loads " + must);
  const w = {}; new Function("window", dataScript())(w);
  const build = "v" + w.APP_VER + " · " + w.DATA_VER;                 /* DawnLobby.buildId(APP_VER, DATA_VER), engine/lobby.js */
  const tpl = fs.readFileSync(TEMPLATE, "utf8");
  const src = {};
  for(const f of engine.concat(["server/referee.js", poolPath])) src[f] = read(f);
  src["page-data"] = dataScript();
  const digest = sha(JSON.stringify([tpl, engine, Object.keys(src).sort().map(k => [k, sha(src[k])])]));

  const buildLine = "build: " + build + " (APP_VER " + w.APP_VER + ", DATA_VER " + w.DATA_VER + ")";
  const digestLine = "bundle-digest: " + digest;
  const head = t => t.replace("__BUILD_LINE__", buildLine).replace("__DIGEST_LINE__", digestLine);
  const wrapFn = (text, arg) => "export default function(" + arg + "){\n" + text + "\n}\n";
  const files = {};            /* relative path -> text, the folder variant */

  /* ---- the folder variant ---- */
  const imports = engine.map(f => "import " + q("./src/" + f) + ";").concat(['import ' + q("./src/server/referee.js") + ";",
    'import runPool from "./src/data/pool.ts";', 'import runData from "./src/data/page-data.ts";']).join("\n");
  files["index.ts"] = head(tpl).replace("__ENGINE_LOAD__", imports);
  for(const f of engine) files["src/" + f] = src[f];
  files["src/server/referee.js"] = src["server/referee.js"];
  files["src/data/pool.ts"] = "// @ts-nocheck\n// GENERATED: data/pool.js, byte for byte, inside a function (its `this`/`window` is whatever is passed).\n" + wrapFn(src[poolPath], "window");
  files["src/data/page-data.ts"] = "// @ts-nocheck\n// GENERATED: index.html's data script (" + buildLine + "), byte for byte, inside a function.\n" + wrapFn(src["page-data"], "window");

  /* ---- the single file: every script inline, in a function of its own (no eval) ---- */
  const inline = [];
  for(const f of engine.concat(["server/referee.js"]))
    inline.push("/* ---- " + f + " ---- */\n(function(){\n" + src[f] + "\n}).call(globalThis);");
  inline.push("/* ---- data/pool.js ---- */\nfunction runPool(window){\n" + src[poolPath] + "\n}");
  inline.push("/* ---- index.html data script ---- */\nfunction runData(window){\n" + src["page-data"] + "\n}");
  const single = head(tpl).replace("__ENGINE_LOAD__", inline.join("\n\n"));

  const config = "# GENERATED by tools/supabase-bundle.js. One function, with JWT verification OFF: the page calls it with the\n" +
    "# project's publishable key (not a user's JWT); a seat is authenticated by its seat key inside the function.\n" +
    "project_id = " + q("fokcpzplomjsraquaaid") + "\n\n[functions." + FN + "]\nenabled = true\nverify_jwt = false\nentrypoint = " + q("./functions/" + FN + "/index.ts") + "\n";

  const out = {};
  for(const [k, v] of Object.entries(files)) out["supabase/functions/" + FN + "/" + k] = v;
  out["supabase/config.toml"] = config;
  out[FN + ".single.ts"] = single;
  const bytes = s => Buffer.byteLength(s);
  const folderBytes = Object.entries(out).filter(([k]) => k.startsWith("supabase/functions/")).reduce((a, [, v]) => a + bytes(v), 0);
  const manifest = {build, appVer: w.APP_VER, dataVer: w.DATA_VER, digest, loaded: engine.concat(["server/referee.js", poolPath]),
    sizes: {singleFile: bytes(single), folderTotal: folderBytes, entry: bytes(files["index.ts"])},
    files: Object.entries(out).map(([k, v]) => ({path: k, bytes: bytes(v), sha256: sha(v)}))};
  out["BUNDLE.json"] = JSON.stringify(manifest, null, 2) + "\n";
  return {out, manifest, build, digest};
}

function write(dir, out){
  fs.rmSync(dir, {recursive: true, force: true});
  for(const [k, v] of Object.entries(out)){ const p = path.join(dir, k); fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, v); }
}

function main(argv){
  const flag = n => argv.indexOf(n) >= 0;
  const outDir = flag("--out") ? path.resolve(argv[argv.indexOf("--out") + 1]) : DEFAULT_OUT;
  const b = cut();
  if(flag("--stamp")){
    fs.writeFileSync(STAMP, JSON.stringify({note: "Written by `node tools/supabase-bundle.js --stamp` AFTER deploying the function. --check compares the tree to this.", build: b.build, digest: b.digest}, null, 2) + "\n");
    console.log("stamped " + path.relative(ROOT, STAMP) + ": " + b.build + " " + b.digest.slice(0, 12));
    return 0;
  }
  if(flag("--check")){
    const bad = [], note = [];
    const man = path.join(outDir, "BUNDLE.json");
    let any = false;
    if(fs.existsSync(man)){
      any = true;
      const m = JSON.parse(fs.readFileSync(man, "utf8"));
      if(m.digest !== b.digest) bad.push("the generated bundle in " + path.relative(ROOT, outDir) + " is STALE: cut from " + m.build + ", the tree is " + b.build + " (or an engine file moved) — run: node tools/supabase-bundle.js");
      else for(const [k, v] of Object.entries(b.out)){ const p = path.join(outDir, k);
        if(!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== v){ bad.push("the generated file " + k + " differs from a fresh cut — run: node tools/supabase-bundle.js"); break; } }
    } else note.push("no generated bundle in " + path.relative(ROOT, outDir) + " (run: node tools/supabase-bundle.js)");
    if(fs.existsSync(STAMP)){
      any = true;
      const s = JSON.parse(fs.readFileSync(STAMP, "utf8"));
      if(s.digest !== b.digest) bad.push("the DEPLOYED function is STALE: it was stamped at " + s.build + ", the tree is " + b.build + " — regenerate, redeploy, then: node tools/supabase-bundle.js --stamp");
      else note.push("the stamped deployment matches the tree (" + b.build + ")");
    } else note.push("nothing stamped yet (server/supabase/DEPLOYED.json): the function has not been recorded as deployed");
    note.forEach(x => console.log("note: " + x));
    if(!any) bad.push("nothing to check against: neither a generated bundle nor a stamp exists");
    bad.forEach(x => console.log("STALE: " + x));
    if(!bad.length) console.log("OK: " + b.build + " " + b.digest.slice(0, 12));
    return bad.length ? 1 : 0;
  }
  write(outDir, b.out);
  const m = b.manifest;
  console.log("build      " + b.build + "   digest " + b.digest.slice(0, 12));
  console.log("wrote      " + path.relative(ROOT, outDir) + "/   (git-ignored)");
  console.log("single     " + path.join(path.relative(ROOT, outDir), FN + ".single.ts") + "   " + m.sizes.singleFile.toLocaleString("en-US") + " bytes");
  console.log("folder     " + path.join(path.relative(ROOT, outDir), "supabase/functions/" + FN) + "/   " + m.sizes.folderTotal.toLocaleString("en-US") + " bytes in " +
              m.files.filter(f => f.path.startsWith("supabase/functions/")).length + " files (entry " + m.sizes.entry.toLocaleString("en-US") + ")");
  return 0;
}
if(require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = {cut, pageScripts, dataScript, NOT_NEEDED, FN};
