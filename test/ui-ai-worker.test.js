/* THE AI WORKER (ui/worker/ai.js, ui/session.js makeBrain): Sharp's thinking moved off the main thread MUST NOT change a
   decision. The worker script's own message handler runs in a node vm (importScripts shimmed, a fresh engine of its own, the
   page's data file), is fed structured clones of states from real self-play, and its answer is held byte for byte to
   DawnSparring.act's. Also: the worker's engine list is a subset of play.html's in the same order, and the page side falls back
   to the main thread on every failure (no Worker, an error). */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const S = require("../tools/selfplay.js");
const Session = require("../ui/session.js");

/* the worker, as a Worker would run it */
function makeWorker(){
  const out = [];
  const sb = {console, setTimeout, clearTimeout, performance: {now: () => performance.now()}, structuredClone};
  sb.self = sb; sb.globalThis = sb;
  sb.postMessage = m => out.push(m);
  sb.importScripts = (...files) => files.forEach(f => {
    const rel = path.posix.normalize("ui/worker/" + f);
    vm.runInContext(read(rel), ctx, {filename: rel});
  });
  const ctx = vm.createContext(sb);
  vm.runInContext(read("ui/worker/ai.js"), ctx, {filename: "ui/worker/ai.js"});
  const send = m => { out.length = 0; sb.onmessage({data: m}); return out.slice(); };
  return {send, ctx, out};
}
const CDN = "https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/normal/";

/* states from real self-play: every Nth ask of the rule policy, both seats, three matchups */
function samples(){
  const got = [];
  const heroes = S.W.HEROES.map(h => h.k);
  const pairs = [[heroes[0], heroes[1], "aiw-1"], [heroes[2], heroes[3], "aiw-2"], [heroes[4 % heroes.length], heroes[5 % heroes.length], "aiw-3"]];
  for(const [a, b, seed] of pairs){
    let n = 0;
    S.play(S.match(a, b, seed, 0), 600, {act: (g, s) => { if(n++ % 9 === 0) got.push([g, s]); return S.SP.act(g, s); }});
  }
  return got;
}

test("the worker's answer equals DawnSparring.act's, byte for byte, on real self-play states (search ON)", () => {
  const wk = makeWorker();
  const ready = wk.send({t: "init", cdn: CDN});
  assert.strictEqual(ready.length, 1, JSON.stringify(ready));
  assert.strictEqual(ready[0].t, "ready", JSON.stringify(ready));
  const all = samples();
  assert.ok(all.length >= 60, "too few states sampled: " + all.length);
  let acted = 0, id = 0;
  for(const [g, s] of all){
    const want = S.SP.act(g, s, {search: true});
    const r = wk.send({t: "act", id: ++id, state: structuredClone(g), seat: s, search: true});
    assert.strictEqual(r.length, 1, "no answer");
    assert.strictEqual(r[0].t, "act", JSON.stringify(r[0]));
    assert.strictEqual(r[0].id, id);
    assert.strictEqual(JSON.stringify(r[0].action), JSON.stringify(want == null ? null : want), "turn " + g.turn + " seat " + s);
    if(want) acted++;
  }
  assert.ok(acted >= 20, "the sample must hold real decisions (" + acted + ")");
});

test("a state survives structured clone: nothing in it is a function or a cycle", () => {
  for(const [g] of samples().slice(0, 30)) assert.doesNotThrow(() => structuredClone(g));
});

test("the worker's engine list is play.html's, a subset, in the same order, and every file exists", () => {
  const html = [...read("play.html").matchAll(/<script src="((?:engine|data)\/[a-z0-9]*\.js)"/g)].map(m => m[1]);
  const w = [...read("ui/worker/ai.js").match(/var ENGINE = \[([\s\S]*?)\];/)[1].matchAll(/"(?:\.\.\/)+([^"]+)"/g)].map(m => m[1]);
  assert.ok(w.length > 10, "the worker's list was not read");
  let at = -1;
  w.forEach(f => {
    const i = html.indexOf(f, at + 1);
    assert.ok(i > at, f + " is not in play.html's list after " + (html[at] || "the start"));
    at = i;
    assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  });
});

/* a stand-in Worker for the page side: runs the real handler, answers on a later tick */
function fakeWorkerClass(opts){
  opts = opts || {};
  return class {
    constructor(){
      if(opts.throws) throw new Error("file:// refuses Workers");
      this.h = makeWorker(); this.dead = false;
    }
    postMessage(m){
      if(opts.errorOn && m.t === "act"){ setTimeout(() => this.onerror && this.onerror(new Error("boom")), 0); return; }
      setTimeout(() => { if(!this.dead) this.h.send(m).forEach(r => this.onmessage && this.onmessage({data: r})); }, 0);
    }
    terminate(){ this.dead = true; }
  };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const think = (st, i) => S.SP.act(st, i, {search: true});

test("makeBrain: no Worker, or a constructor that throws, is the main-thread path (null brain)", () => {
  const pick = {search: true};
  assert.strictEqual(Session.makeBrain({CDN}, pick, () => null), null);
  assert.strictEqual(Session.makeBrain({CDN, Worker: fakeWorkerClass({throws: true})}, pick, () => null), null);
  assert.strictEqual(Session.makeBrain({CDN, Worker: fakeWorkerClass()}, {search: false}, () => null), null, "Steady never needs a Worker");
});

test("makeBrain: the policy returns the worker's answer when it is in, equal to act's; else (error, other state) the page's own", async () => {
  const [g, s] = samples().find(([gg, ss]) => S.SP.act(gg, ss, {search: true}));
  const want = JSON.stringify(think(g, s));
  const b = Session.makeBrain({CDN, Worker: fakeWorkerClass()}, {search: true}, () => g);
  b.request(g, s);
  let used = 0; const spy = (st, i) => { used++; return think(st, i); };
  assert.strictEqual(JSON.stringify(b.policy(g, s, spy)), want); assert.strictEqual(used, 1, "before the answer is in, the page computes");
  for(let i = 0; i < 100; i++){ await wait(100); used = 0; b.policy(g, s, spy); if(!used) break; }
  used = 0;
  assert.strictEqual(JSON.stringify(b.policy(g, s, spy)), want); assert.strictEqual(used, 0, "the worker's answer was used");
  assert.strictEqual(JSON.stringify(b.policy(structuredClone(g), s, spy)), want); assert.strictEqual(used, 1, "another state object is the page's to compute");
  b.dispose();

  const bad = Session.makeBrain({CDN, Worker: fakeWorkerClass({errorOn: true})}, {search: true}, () => g);
  bad.request(g, s);
  let fired = false; bad.later(() => { fired = true; }, 1);
  await wait(60);
  assert.ok(fired, "a waiting tick is released when the worker errors");
  used = 0;
  assert.strictEqual(JSON.stringify(bad.policy(g, s, spy)), want); assert.strictEqual(used, 1);
  bad.dispose();
});
