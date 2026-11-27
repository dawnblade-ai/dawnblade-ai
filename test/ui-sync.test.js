/* CRESCENDO's static guards (no browser): play.html loads the same engine, in the same order, as index.html;
   no Babel / modules; ui/ never re-declares an engine export or touches index.html's bridge names; the viewport is
   read in one place; ui/data.js is current; each ui file stays readable. docs/crescendo/FRAMEWORK.md 4.1 / 5. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const srcList = h => [...h.matchAll(/<script src="((?:engine|data)\/[a-z0-9]*\.js)"/g)].map(m => m[1]);
const uiFiles = () => fs.readdirSync(path.join(ROOT, "ui")).filter(f => /\.js$/.test(f) && f !== "data.js");
/* comments and string literals removed, so prose cannot pass or fail a scan */
const code = s => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/[^\n]*/g, "$1").replace(/`(?:\\.|[^`\\])*`/g, "``").replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""');

test("play.html loads index.html's data and engine scripts, same order", () => {
  assert.deepStrictEqual(srcList(read("play.html")), srcList(read("index.html")));
});

test("play.html has no Babel and no module scripts, and the contract's viewport meta", () => {
  const h = read("play.html");
  assert.ok(!/<script[^>]*babel/i.test(h), "babel");
  assert.ok(!/type=["']module["']/.test(h), "type=module");
  assert.ok(h.includes('<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'));
  const ui = [...h.matchAll(/<script src="(ui\/[a-z.]+)"/g)].map(m => m[1]);
  assert.strictEqual(ui[ui.length - 1], "ui/boot.js", "boot.js loads last");
  ui.forEach(f => assert.ok(fs.existsSync(path.join(ROOT, f)), f + " is loaded by play.html but does not exist"));
});

test("index.html redirects ?ui=crescendo before React and Babel load", () => {
  const h = read("index.html"), at = h.indexOf("ui=crescendo");
  assert.ok(at > 0 && at < h.indexOf("react.production.min.js") && at < h.indexOf("babel.min.js"));
});

test("no ui/*.js declaration shares a name with an engine export or the bridge's bare globals", () => {
  const exportsOf = new Set();
  fs.readdirSync(path.join(ROOT, "engine")).filter(f => /\.js$/.test(f)).forEach(f => {
    let m; try { m = require(path.join(ROOT, "engine", f)); } catch(e){ return; }
    if(m && typeof m === "object") Object.keys(m).forEach(k => exportsOf.add(k));
  });
  const idx = read("index.html"), b = idx.indexOf("The bridge:"), bridge = idx.slice(b, idx.indexOf("</script>", b));
  const bare = new Set([...bridge.matchAll(/(?:\bvar\s+|,\s*\n?\s*)([A-Za-z_$][\w$]*)\s*=\s*Dawn[A-Za-z]+\./g)].map(m => m[1]));
  assert.ok(bare.size > 100 && bare.has("norm") && bare.has("hasKw"), "the bridge was not read (" + bare.size + ")");
  uiFiles().forEach(f => {
    const src = code(read("ui/" + f));
    /* factory-level (column 0) declarations are the module's top level */
    [...src.matchAll(/^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm)].forEach(m =>
      assert.ok(!exportsOf.has(m[1]), `ui/${f} declares "${m[1]}", an engine export`));
    bare.forEach(n => {
      const re = new RegExp("(?<![.\\w$])" + n.replace(/\$/g, "\\$") + "(?![\\w$])(?!\\s*:)", "g");
      assert.ok(!re.test(src), `ui/${f} uses "${n}", a bare global of index.html's bridge`);
    });
  });
});

test("every ui file is one namespace, and none re-declares a Dawn namespace the engine owns", () => {
  const eng = new Set(fs.readdirSync(path.join(ROOT, "engine")).map(f => read("engine/" + f)).join("\n").match(/root\.(Dawn[A-Za-z]+)\s*=/g).map(s => s.replace(/root\.|\s*=/g, "")));
  uiFiles().forEach(f => {
    const names = [...read("ui/" + f).matchAll(/root\.(DawnUI[A-Za-z]+)\s*=/g)].map(m => m[1]);
    assert.strictEqual(names.length, 1, f + " assigns " + names.length + " DawnUI namespaces");
    assert.ok(!eng.has(names[0]));
  });
});

test("the viewport is read in one place: no 100vh / innerHeight in ui/ outside boot.js", () => {
  fs.readdirSync(path.join(ROOT, "ui")).filter(f => /\.(js|css)$/.test(f) && f !== "data.js" && f !== "boot.js").forEach(f => {
    const s = code(read("ui/" + f));
    assert.ok(!/\b\d+(\.\d+)?vh\b/.test(s), f + " uses a vh unit");
    assert.ok(!/innerHeight/.test(s), f + " reads innerHeight");
  });
});

test("ui/data.js is current (tools/ui-data.js --check)", () => {
  execFileSync(process.execPath, [path.join(ROOT, "tools", "ui-data.js"), "--check"], { stdio: "pipe" });
});

test("each ui/*.js stays under 60 KB", () => {
  uiFiles().forEach(f => assert.ok(fs.statSync(path.join(ROOT, "ui", f)).size <= 60 * 1024, f));
});
