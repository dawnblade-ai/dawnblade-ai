/* ============================================================
   explain.test.js — [HERO]'S CALL (v5.47, QUEUE S13)

   The table's advisor box used to run `advisor.advise`, a second policy
   beside the one that actually plays seat 1. Its advice and the seat's
   play could disagree, and following it could meet a refusal.

   The box now shows `sparring.explain(g, seat)`: the seat policy's OWN
   move, with the reason it chose that move and a line naming the cards.
   `explain` wraps `act` and nothing else: every return site in the policy
   is `tag(key, action)`, the tag writes a module-level note only while
   `explain` is asking, and `act` alone is unchanged.

   So the census asks three things at every state of 30 self-play games,
   for both seats: `explain` proposes exactly what `act` does, every action
   has a reason, and every action has a line that is not its raw type.

   H11 rides with it. The gear fallback destroyed a piece whose whole
   payout is resources (Blossom of Spring) for an {r} that fizzled at end
   of turn; shown on screen as a call, that is advice to throw a card away.
   `judge.abPieceForRes` names those pieces and the fallback skips them.
   ============================================================ */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {match, J, SP} = require("../tools/selfplay.js");
const {DEV_VOICE} = require("./helpers/voice.js");

const ROOT = path.join(__dirname, "..");
const read = f => fs.readFileSync(path.join(ROOT, f), "utf8");
const HEROES = ["arakni", "azalea", "blaze", "boltyn", "bravo", "briar", "dash", "dorinthea",
                "enigma", "fai", "gravy", "iyslander", "kayo", "lyath", "viserai"];

/* The call is addressed to ONE player, so the second person is right here
   (it is banned in the shared feed only). A camelCase word is a key or an
   identifier leaking onto the screen. */
const CALL_VOICE = DEV_VOICE.filter(([, why]) => why !== "the second person")
  .concat([[/\b[a-z]+[A-Z][A-Za-z]*\b/, "a camelCase identifier"]]);
const faults = s => CALL_VOICE.filter(([rx]) => rx.test(s)).map(([, why]) => why);

let CENSUS = null;
function census(){
  if(CENSUS) return CENSUS;
  const out = {states: 0, acted: 0, bad: [], keys: {}, types: {}, lines: new Set(), resBurn: [], chargeOk: [], chargeBad: []};
  for(let i = 0; i < HEROES.length; i++){
    const k0 = HEROES[i], k1 = HEROES[(i + 3) % HEROES.length];
    for(const first of [0, 1]){
      let g = match(k0, k1, `${k0}-${k1}-ex`, first), steps = 0;
      while(!g.over && steps < 4000){
        let moved = false;
        for(const s of [0, 1]){
          const a = SP.act(g, s), e = SP.explain(g, s);
          out.states++;
          if(JSON.stringify(a) !== JSON.stringify(e.action))
            out.bad.push(`${k0}/${k1} seat ${s}: act ${JSON.stringify(a)} explain ${JSON.stringify(e.action)}`);
          if(!a) continue;
          out.acted++;
          out.types[a.t] = (out.types[a.t] || 0) + 1;
          out.keys[e.key] = (out.keys[e.key] || 0) + 1;
          if(!e.why) out.bad.push(`${a.t} has no reason (key ${e.key})`);
          if(!e.line || e.line === a.t) out.bad.push(`${a.t} has no line: ${JSON.stringify(a)}`);
          else out.lines.add(e.line);
          if(e.key === "chargeFirst"){
            const v = J.chargeView(g, s, a.uid, a.from || "hand");
            (v && v.offers ? out.chargeOk : out.chargeBad).push(`${k0}/${k1} seat ${s}: ${e.line}`);
          }
          /* THE FALLBACK never burns one; the unlock (test/arspay.test.js) is
             a different branch with its own key, spending the piece for an
             attack it makes affordable. */
          if(a.t === "activate" && J.abPieceForRes(g, s, a.uid) && e.key !== "resUnlock")
            out.resBurn.push(`${k0}/${k1} seat ${s}: ${a.uid}`);
          const o = J.reduce(g, a, s);
          if(o.error) continue;
          g = o.state; steps++; moved = true; break;
        }
        if(!moved) break;
      }
    }
  }
  return (CENSUS = out);
}

test("explain proposes exactly what act does, with a reason and a line, at every state", () => {
  const c = census();
  /* the denominator, so a census that stops driving games cannot pass */
  assert.ok(c.states > 10000, "states " + c.states);
  assert.ok(c.acted > 5000, "actions " + c.acted);
  assert.deepEqual(c.bad.slice(0, 8), [], c.bad.length + " faults");
});

test("the census reaches the action types a game is made of", () => {
  const t = census().types;
  for(const k of ["play", "pass", "activate", "defend", "paySel", "payConfirm", "endTurn",
                  "arsenal", "promptSel", "promptConfirm", "promptChoose", "boost", "fuse",
                  "charge", "split", "xval"])
    assert.ok(t[k] > 0, k + " was never proposed, so its line was never checked");
});

test("every action type the policy can send has a case in the line writer", () => {
  const src = read("engine/sparring.js");
  /* bounded at the next top-level function, never at a named neighbour (v4.57) */
  const at = src.indexOf("function lineOf(");
  const body = src.slice(at, src.indexOf("\nfunction ", at + 1));
  assert.ok(body.length > 500, "the line writer was found");
  const sent = new Set([...src.matchAll(/\bt: "([A-Za-z]+)"/g)].map(m => m[1]));
  /* a prompt is answered by `judge.autoAnswer`, so its vocabulary is judge's */
  for(const t of J.PROMPT_ACTIONS) if(t !== "promptTakeBack" && t !== "promptMove") sent.add(t);
  assert.ok(sent.size >= 15, "the scan found " + sent.size + " action types");
  const missing = [...sent].filter(t => !body.includes(`"${t}"`));
  assert.deepEqual(missing, [], "these would print their raw type as the call");
});

test("every reason is keyed from a site in the policy, and the census names what it reached", () => {
  const src = read("engine/sparring.js");
  const a = src.indexOf("const CALL_WHY = {"), b = src.indexOf("};", a);
  const rest = src.slice(0, a) + src.slice(b);
  const keys = Object.keys(SP.CALL_WHY);
  assert.ok(keys.length >= 40);
  const orphan = keys.filter(k => !rest.includes(`"${k}"`));
  assert.deepEqual(orphan, [], "a reason no site can tag is dead text");
  /* BOTH DIRECTIONS (v4.12): the keys 30 games never reach are pinned, so
     a policy change that starts or stops reaching one is a deliberate edit.
     Each still has a tag site above. */
  const seen = census().keys;
  for(const k of Object.keys(seen)) assert.ok(SP.CALL_WHY[k], "reached key " + k + " has no reason");
  assert.deepEqual(keys.filter(k => !seen[k]).sort(),
    ["addPayNo", "allocAll", "allyTake", "answer", "arenaAP", "arenaRes", "boostNo", "chargeDone",
     "chargeNone", "discost", "payCancel", "pitchChi"]);
});

test("every reason and every line reads as game text", () => {
  const bad = [];
  for(const [k, s] of Object.entries(SP.CALL_WHY)){
    const f = faults(s);
    if(f.length) bad.push(k + ": " + f.join(", "));
    if(!/[.!]$/.test(s)) bad.push(k + ": not a sentence");
  }
  for(const l of census().lines){ const f = faults(l); if(f.length) bad.push(l + ": " + f.join(", ")); }
  assert.deepEqual(bad, []);
  /* the scan is alive */
  assert.deepEqual(faults("keepsAP via fx.ga in sparring.js"),
    ["a filename", "a parse field", "a camelCase identifier"]);
  assert.deepEqual(faults("Pitch your highest-pitch card."), []);
});

test("explain leaves act alone: no note survives the call", () => {
  const g = match("kayo", "dorinthea", "ex-alone", 0);
  const before = JSON.stringify(SP.act(g, 0));
  SP.explain(g, 0);
  assert.equal(JSON.stringify(SP.act(g, 0)), before);
  const none = SP.explain(g, 1);
  assert.deepEqual(none, {action: null, key: null, why: null, line: null}, "a seat with nothing to decide");
});

test("H11: a piece whose whole payout is resources is never destroyed by the fallback", () => {
  const g = match("arakni", "kayo", "h11", 0);
  const by = n => g.sides[0].gear.find(x => x.name === n);
  assert.equal(J.abPieceForRes(g, 0, by("Blossom of Spring").uid), true);
  assert.equal(J.abPieceForRes(g, 0, by("Danger Digits").uid), false, "a jab is not a resource");
  const v = match("viserai", "kayo", "h11", 0);
  const haunt = v.sides[0].gear.find(x => x.name === "Beckoning Haunt");
  assert.equal(J.abPieceForRes(v, 0, haunt.uid), false, "its destroy returns an aura and still fires");
  assert.equal(J.abPieceForRes(g, 0, 99999), false, "an unknown uid answers false");
  assert.deepEqual(census().resBurn, [], "the policy proposed burning a resource piece");
});

test("the call is the hero's: no Claude's call anywhere, the trainer's is the Coach's", () => {
  const html = read("index.html");
  for(const f of ["index.html", "engine/advisor.js", "engine/build.js", "engine/README.md"])
    assert.ok(!/Claude's (call|read)|CLAUDE'S CALL/.test(read(f)), f);
  assert.match(html, /\{label\|\|"Coach's call"\}/, "the trainer's box keeps advise, relabelled");
  const t = html.indexOf("<HERO>'S CALL (v5.47)");
  assert.ok(t > 0, "the table's box was found");
  const box = html.slice(t, html.indexOf("read={myBuild.read}/>}", t));
  assert.match(box, /local && mySeat === 0 && <Advisor/, "local sessions and seat 0 only, as before");
  assert.match(box, /DawnSparring\.explain\(g, mySeat\)/);
  assert.match(box, /\+ "'s call"/);
  assert.match(box, /" is deciding\."/, "when the seat cannot act, the box says who is deciding");
  assert.ok(!/advView|advise\(/.test(box), "the table no longer runs the coach's policy");
});

test("the turn-one read names the hero whose deck it reads", () => {
  for(const [k, n] of [["blaze", "Blaze"], ["kayo", "Kayo"], ["dorinthea", "Dorinthea"]]){
    const g = match(k, "lyath", "read", 0);
    assert.ok(g.builds[0].read.startsWith(n + "'s read: "), g.builds[0].read);
  }
});

test("S14: \"charge first\" names only a card that offers a charge", () => {
  /* QUEUE S14. `chargeView` answers for every card, so in v5.47 a go-again
     attack for an uncharged seat was labelled "chargeFirst": 38 of 54 such
     calls over 15 games named a card that offers no charge (Fai's Ronin
     Renegade the sharpest). The key moves; the action does not, which the
     census above holds. */
  const c = census();
  assert.deepEqual(c.chargeBad.slice(0, 5), [], c.chargeBad.length + " mislabelled");
  assert.ok(c.chargeOk.filter(l => /^boltyn\/|\/boltyn /.test(l)).length > 3,
    "the positive control: Boltyn's charge-first calls are still named (" + c.chargeOk.length + ")");
  assert.ok(c.keys.atkKeepsAP > 20, "the go-again attacks are named as keeping the point");
});
