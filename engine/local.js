/* ============================================================
   Dawnblade engine — local.js  ·  A SESSION WITH NO NETWORK (v2.79)

   THE LAST THING KEEPING SOLO AND TABLE APART.

   After v2.77 and v2.78 there is one rules engine: `judge.reduce` drives
   the CR turn structure and calls `effects.js` for the card semantics. But
   the only way to REACH it was `net.js` — a session that needs a second
   phone — so a player alone still went to `Battle`, which is a different
   engine with its own dummy branch inside the rules.

   This is the same session with the network taken out. It exposes exactly
   the surface `TableBoard` already drives:

       submit(action) -> null | reason      state()  seq()  hash()
       seat()  status()  stats()

   so the board does not learn a second way to play a game. `net.js`'s own
   `loopback()` proves that shape is enough; this proves it does not need
   a channel at all.

   WHAT MAKES IT A GAME RATHER THAN A HALF ONE is the OTHER seat. It is
   given a `policy` — `sparring.act`, or anything else that answers "what
   do you do" — and after every accepted action it lets that seat act
   until it has nothing left to say. Solo, hotseat and network then differ
   only in what is calling `reduce`, which is the whole point of the
   rebuild.

   THREE RULES IT KEEPS, EACH BECAUSE BREAKING IT COST SOMETHING:

   1. THE POLICY PROPOSES AND THE JUDGE DISPOSES. Every action from the
      policy goes through the same `reduce`, and a refusal is RECORDED
      rather than swallowed — `sparring.js`'s contract is that a refusal
      is always a bug in the policy, and a session that quietly ate them
      would make that contract unenforceable from the outside.

   2. IT NEVER ANSWERS FOR THE PLAYER. A prompt addressed to the local
      seat stays live and waits. `autoAnswer` is offered to the OTHER seat
      only, through the policy — a session that helpfully answered your
      sheet would be making your decisions.

   3. IT TERMINATES. The policy loop is bounded, and a bound that is hit
      is reported as a stall rather than spun on. An unanswerable prompt
      or a policy that proposes the same refused action forever is a real
      failure mode — it turned seven drills red in v2.78 — and it must
      look like one.
   ============================================================ */
(function(root, factory){
  if(typeof module==="object" && module.exports) module.exports = factory();
  else root.DawnLocal = factory();
})(typeof self!=="undefined" ? self : this, function(){

/* How many actions the other seat may take between two of yours. A whole
   turn of theirs is a few dozen — most of them passes, which is the CR's
   own shape — so this is generous by an order of magnitude and exists
   only so a loop cannot spin. */
const STEP_LIMIT = 400;

function createLocal(o){
  o = o || {};
  const seat = o.seat != null ? o.seat : 0;
  const other = 1 - seat;
  const reduce = o.reduce, legal = o.legal;
  if(typeof reduce !== "function") throw new Error("local.js: no reduce");

  let state = o.state || null;
  let seq = 0;
  let status = state ? "ready" : "empty";
  const stats = {sent: 0, refused: 0, policy: 0, policyRefused: 0, stalls: 0};

  const emit = e => { if(o.onEvent) o.onEvent(e); };
  const push = () => { if(o.onState) o.onState(state); };

  /* THE OTHER SEAT TAKES ITS TURN. Called after every accepted action —
     including the very first push — because whether it has anything to do
     depends entirely on where the rules just left the game, and that is a
     question only `reduce` can answer. */
  function runPolicy(){
    if(!o.policy) return;
    for(let i = 0; i < STEP_LIMIT; i++){
      if(!state || state.over) return;
      const a = o.policy(state, other);
      if(!a) return;
      const out = reduce(state, a, other);
      if(out.error){
        /* A REFUSAL IS ALWAYS A BUG IN THE POLICY (sparring.js's own
           contract), so it is surfaced rather than retried — retrying the
           same refused action is how a loop becomes a spin. */
        stats.policyRefused++;
        emit({t: "policy-refused", action: a, reason: out.error});
        return;
      }
      state = out.state; seq++; stats.policy++;
    }
    stats.stalls++;
    emit({t: "stalled", reason: "the other seat took " + STEP_LIMIT + " actions without stopping"});
  }

  /* One action from the local player. Returns null when it was accepted,
     or the judge's reason — the same contract `net.js`'s submit has, so
     the board's single dispatch point does not change. */
  function submit(a){
    if(!state) return "no game";
    const why = legal ? legal(state, a, seat) : null;
    if(why){ stats.refused++; emit({t: "refused", reason: why}); return why; }
    const out = reduce(state, a, seat);
    if(out.error){ stats.refused++; emit({t: "refused", reason: out.error}); return out.error; }
    state = out.state; seq++; stats.sent++;
    runPolicy();
    push();
    return null;
  }

  /* Called once by the board when it mounts. The other seat may be ON THE
     PLAY, in which case the game must not sit waiting for a player whose
     turn it is not — this is the same thing `Battle`'s opponent-first
     opening does, and forgetting it is a board that looks frozen. */
  function start(){
    if(!state) return;
    status = "ready";
    runPolicy();
    push();
  }

  return {
    submit, start,
    state:  () => state,
    seq:    () => seq,
    seat:   () => seat,
    isHost: () => true,
    status: () => status,
    stats:  () => ({...stats}),
    /* The board reports a hash beside the sequence so a stuck game can be
       described in one line, exactly as at a networked table. There is
       nobody to disagree with here, so it is diagnostic rather than a
       desync check — supplied by the caller, because hashing is wire.js's
       job and this module has no business importing it for a report. */
    hash:   () => o.hash ? o.hash(state) : null,
    /* A local session has no channel, so these exist to keep the surface
       identical rather than to do anything. A board that has to ask which
       kind of session it holds is a board with two ways to play a game. */
    receive(){}, tick(){}, resync(){}, join(){}
  };
}

/* ---- THE RECORD AGAINST AN AI HERO (v5.84, decision D, CEO 2026-11-02) ----
   A table win over an AI hero once paid the dummy's trophy and best score by
   mistake; v5.79 stopped that, and it earned nothing. This is what it earns
   now: a count, per AI hero and per level (Sharp / Steady), of the finished
   games played against it on this device. Nothing is pulled and nothing is
   scored; a draw is a draw and a concession is a loss (CR 4.5.3c: the
   player who concedes loses the game).

   ONLY A FINISHED LOCAL GAME AGAINST A HERO. The board calls `recordResult`
   once, when `over` arrives; a game left before that never reaches it, and
   a two-phone table or the trainer never calls it at all.

   STORAGE IS A CONVENIENCE AND MAY NOT EXIST. A private window, a phone with
   site data blocked, or a full quota throws on access, on read or on write.
   Every touch is inside try/catch: a read that fails is an empty record, a
   write that fails is reported (false) and the game goes on. The storage is
   handed in as a THUNK, because on some browsers merely reading
   `window.localStorage` is what throws.

   Shape, under RECORD_KEY:
     {v: 1, foes: {<hero key>: {sharp: {w, l, d}, steady: {w, l, d}}}}
   Only pairs that were played appear. Anything else found there (another
   version, a hand edit, a half-written value) reads as empty rather than as
   a number nobody counted. */
const RECORD_KEY = "dawnblade.aiRecord";
const LEVELS = ["sharp", "steady"];
const OUTCOMES = ["w", "l", "d"];
const count = n => (Number.isInteger(n) && n >= 0 ? n : 0);

/* what one finished game was, from `mySeat`'s side: "w" | "l" | "d", or null
   while there is no result (an unfinished or abandoned game) */
function outcomeOf(over, mySeat){
  if(!over || typeof over !== "object") return null;
  if(over.winner === null || over.winner === undefined) return over.how ? "d" : null;
  return over.winner === mySeat ? "w" : "l";
}

/* a clean copy: known heroes' known levels, non-negative whole counts */
function cleanRecord(r){
  const out = {v: 1, foes: {}};
  if(!r || typeof r !== "object" || r.v !== 1 || !r.foes || typeof r.foes !== "object") return out;
  for(const k of Object.keys(r.foes)){
    const f = r.foes[k]; if(!f || typeof f !== "object") continue;
    for(const lv of LEVELS){
      const c = f[lv]; if(!c || typeof c !== "object") continue;
      (out.foes[k] = out.foes[k] || {})[lv] = {w: count(c.w), l: count(c.l), d: count(c.d)};
    }
  }
  return out;
}

/* a NEW record with exactly one counter one higher; the input is untouched.
   An unknown level or outcome, or no hero, changes nothing. */
function bumpRecord(r, foeKey, level, outcome){
  const out = cleanRecord(r);
  if(!foeKey || typeof foeKey !== "string" || !LEVELS.includes(level) || !OUTCOMES.includes(outcome)) return out;
  const f = out.foes[foeKey] = out.foes[foeKey] || {};
  const c = f[level] = f[level] || {w: 0, l: 0, d: 0};
  c[outcome] += 1;
  return out;
}

function loadRecord(getStorage){
  try {
    const ls = getStorage && getStorage(); if(!ls) return cleanRecord(null);
    const raw = ls.getItem(RECORD_KEY);
    return cleanRecord(raw == null ? null : JSON.parse(raw));
  } catch(e){ return cleanRecord(null); }
}

function saveRecord(getStorage, r){
  try {
    const ls = getStorage && getStorage(); if(!ls) return false;
    ls.setItem(RECORD_KEY, JSON.stringify(cleanRecord(r)));
    return true;
  } catch(e){ return false; }
}

/* the board's one call: read, bump, write. Answers the record it now holds
   (the bumped one even when the write failed, so the screen can still show
   it this session), or null when there was nothing to count. */
function recordResult(getStorage, foeKey, sharp, over, mySeat){
  const o = outcomeOf(over, mySeat);
  if(!o || !foeKey) return null;
  const r = bumpRecord(loadRecord(getStorage), foeKey, sharp ? "sharp" : "steady", o);
  saveRecord(getStorage, r);
  return r;
}

return {createLocal, STEP_LIMIT,
        RECORD_KEY, outcomeOf, cleanRecord, bumpRecord, loadRecord, saveRecord, recordResult};
});
