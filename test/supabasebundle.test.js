/* test/supabasebundle.test.js — tools/supabase-bundle.js (SERVER S3): the deploy folder is cut from the tree, deterministic,
   free of eval and secrets, matches the page's build id and function name, and `--check` notices a stale copy.
   (The function itself is rehearsed under Deno by tools/supabase-rehearse.js, which needs a deno binary.) */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {spawnSync} = require("child_process");
const B = require("../tools/supabase-bundle.js");
const Lobby = require("../engine/lobby.js");

const ROOT = path.join(__dirname, "..");
const TOOL = path.join(ROOT, "tools", "supabase-bundle.js");
const NOSTAMP = path.join(os.tmpdir(), "dawnblade-no-stamp-" + process.pid + ".json");
const run = (...a) => spawnSync(process.execPath, [TOOL, ...a, "--stamp-file", NOSTAMP], {encoding: "utf8"});
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "dawnblade-bundle-test-"));

test("the cut is deterministic and its build line is the page's own DawnLobby.buildId", () => {
  const a = B.cut(), b = B.cut();
  assert.equal(a.digest, b.digest);
  assert.deepEqual(a.out, b.out, "byte for byte");
  const w = {}; new Function("window", B.dataScript())(w);
  assert.equal(a.build, Lobby.buildId(w.APP_VER, w.DATA_VER), "the function's build id is the page's");
  assert.ok(a.out["supabase/functions/table/index.ts"].includes("build: " + a.build));
  assert.ok(a.out["table.single.ts"].includes("bundle-digest: " + a.digest));
});

test("what is loaded: the engine in the page's own order, straight copies; the AI seat, the local table and the page's own channel are left out", () => {
  const m = B.cut(), page = B.pageScripts().filter(f => f.startsWith("engine/"));
  const loaded = m.manifest.loaded;
  assert.deepEqual(loaded.filter(f => f.startsWith("engine/")), page.filter(f => !B.NOT_NEEDED.has(f)), "page order, minus the unneeded");
  for(const f of B.NOT_NEEDED) assert.ok(!loaded.includes(f), f + " is not loaded by the function");
  for(const f of loaded.filter(f => f.startsWith("engine/") || f === "server/referee.js"))
    assert.equal(m.out["supabase/functions/table/src/" + f], fs.readFileSync(path.join(ROOT, f), "utf8"), f + " is a straight copy");
  const pool = fs.readFileSync(path.join(ROOT, "data/pool.js"), "utf8");
  assert.ok(m.out["supabase/functions/table/src/data/pool.ts"].includes(pool), "the pool is inside its wrapper byte for byte");
  assert.ok(m.out["supabase/functions/table/src/data/page-data.ts"].includes(B.dataScript()), "the page's data script, likewise");
  assert.equal(B.FN, "table");
  const cfg = fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/window\.SERVER_TABLE = \{[^}]*fn: "([^"]+)"/);
  assert.equal(cfg[1], B.FN, "the page calls the function the bundle is named for");
  assert.match(m.out["supabase/config.toml"], /\[functions\.table\][\s\S]*verify_jwt = false/);
});

test("the generated entry uses no eval, no new Function, no file reads, and carries no secret", () => {
  const m = B.cut();
  const tpl = fs.readFileSync(path.join(ROOT, "server", "supabase", "entry.template.ts"), "utf8");
  const code = t => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for(const [what, text] of [["template", tpl], ["folder entry", m.out["supabase/functions/table/index.ts"]]]){
    assert.ok(!/\beval\s*\(|new Function\b|Deno\.(readFile|readTextFile|open)/.test(code(text)), what + " reaches for eval or the file system");
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]|service_role\s*[:=]\s*["'`]/.test(text), what + " carries a secret");
  }
  assert.ok(!/sb_publishable_/.test(tpl), "the template does not even carry the public key: the page owns it");
  assert.match(tpl, /https:\/\/dawnblade-ai\.github\.io/); assert.match(tpl, /"null"/, "CORS: the Pages origin and file://'s null origin");
  assert.match(tpl, /SUPABASE_SERVICE_ROLE_KEY/); assert.match(tpl, /table_put/); assert.match(tpl, /realtime\/v1\/api\/broadcast/);
  assert.match(tpl, /private: false/, "the channel is public by decision (S3, Option B)");
});

test("--check: fresh is OK; a stale digest, a changed copy and a missing bundle all fail; --stamp is the only thing that writes the tracked stamp", () => {
  const d = tmp();
  try {
    assert.equal(run("--check", "--out", d).status === 0, false, "nothing generated yet (and no stamp): nothing to check against");
    assert.equal(run("--out", d).status, 0);
    const ok = run("--check", "--out", d);
    assert.equal(ok.status, 0, ok.stdout);
    assert.match(ok.stdout, /OK: v/);
    /* a copy edited after the cut */
    const f = path.join(d, "supabase/functions/table/src/engine/judge.js");
    fs.appendFileSync(f, "\n// edited");
    const bad = run("--check", "--out", d);
    assert.equal(bad.status, 1); assert.match(bad.stdout, /STALE: the generated file/);
    run("--out", d);
    /* a bundle cut from another release */
    const man = path.join(d, "BUNDLE.json"), m = JSON.parse(fs.readFileSync(man, "utf8"));
    m.digest = "0".repeat(64); m.build = "v0.01 · sage-v0"; fs.writeFileSync(man, JSON.stringify(m));
    const old = run("--check", "--out", d);
    assert.equal(old.status, 1); assert.match(old.stdout, /STALE: the generated bundle .* cut from v0\.01/);
  } finally { fs.rmSync(d, {recursive: true, force: true}); }
  /* the stamp: written by --stamp, compared by --check */
  const d2 = tmp();
  try {
    assert.equal(run("--out", d2).status, 0);
    assert.equal(run("--stamp").status, 0);
    assert.ok(fs.existsSync(NOSTAMP));
    assert.equal(run("--check", "--out", d2).status, 0, "stamp and bundle match the tree");
    const s = JSON.parse(fs.readFileSync(NOSTAMP, "utf8")); s.digest = "1".repeat(64); s.build = "v0.01 · sage-v0"; fs.writeFileSync(NOSTAMP, JSON.stringify(s));
    const r = run("--check", "--out", d2);
    assert.equal(r.status, 1); assert.match(r.stdout, /STALE: the DEPLOYED function is STALE: it was stamped at v0\.01/);
  } finally { fs.rmSync(d2, {recursive: true, force: true}); fs.rmSync(NOSTAMP, {force: true}); }
});

test("the output folder is git-ignored", () => {
  assert.match(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8"), /^server\/supabase\/dist\/$/m);
});
