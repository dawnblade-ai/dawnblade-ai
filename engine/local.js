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

   PACED, AND HEARD (Table Talk TT0, v7.18; docs/TABLE-TALK.md §4.4). A
   person across a real table plays one card at a time and says it. Two
   options, both OFF unless passed, so nothing that already calls
   `createLocal` moves:
     `pace`   — a number of ms, or `(prev, action, next) => ms`. The other
                seat's actions are applied ONE PER TICK and the board is
                pushed after each, so a board can show and announce each
                play before the next. The first tick after a push is asked
                as `pace(null, null, state)`. A tick re-asks the policy of
                the state as it then stands, so a tick that finds nothing to
                do (the player acted, the game ended) simply stops. The same
                states are reached as unpaced, one push at a time
                (test/local.test.js proves it on real games).
     `onStep` — `({seat, action, prev, next})`, for EVERY accepted action,
                either seat's, paced or not: what a board needs to say what
                just happened (engine/announce.js reads exactly this).
   `later`/`cancel` replace setTimeout/clearTimeout (drills drive the ticks
   by hand). `nudge()` runs a waiting tick now; `dispose()` drops it (the board
   unmounting).
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
  /* every accepted action, either seat's: the states either side of it (Table Talk's announcer) */
  const heard = (who, a, prev) => { if(o.onStep) o.onStep({seat: who, action: a, prev, next: state}); };

  /* PACED (v7.18): one policy action per tick, `pace` ms apart; `run` counts this run's actions for the bound */
  const paced = !!o.pace;
  const later = o.later || ((fn, ms) => setTimeout(fn, ms));
  const cancel = o.cancel || (h => clearTimeout(h));
  let tick = null, run = 0;
  const paceOf = (prev, a, next) => {
    const ms = typeof o.pace === "function" ? o.pace(prev, a, next) : +o.pace;
    return ms > 0 ? ms : 0;
  };
  const schedule = ms => {
    if(tick != null) cancel(tick);
    tick = later(() => { tick = null; policyTick(); }, ms);
  };

  /* ONE ACTION OF THE OTHER SEAT'S: false when it had nothing to do or was
     stopped (a refusal, the bound), true when an action was applied. Shared
     by the unpaced loop and the paced tick, so the two cannot drift. */
  function policyStep(){
    if(!state || state.over) return false;
    if(run >= STEP_LIMIT){
      stats.stalls++;
      emit({t: "stalled", reason: "the other seat took " + STEP_LIMIT + " actions without stopping"});
      return false;
    }
    const a = o.policy(state, other);
    if(!a) return false;
    const prev = state;
    const out = reduce(state, a, other);
    if(out.error){
      /* A REFUSAL IS ALWAYS A BUG IN THE POLICY (sparring.js's own
         contract), so it is surfaced rather than retried — retrying the
         same refused action is how a loop becomes a spin. */
      stats.policyRefused++;
      emit({t: "policy-refused", action: a, reason: out.error});
      return false;
    }
    state = out.state; seq++; stats.policy++; run++;
    heard(other, a, prev);
    return {a, prev};
  }
  function policyTick(){
    const did = policyStep();
    if(!did) return;
    push();
    schedule(paceOf(did.prev, did.a, state));
  }

  /* THE OTHER SEAT TAKES ITS TURN. Called after every accepted action —
     including the very first push — because whether it has anything to do
     depends entirely on where the rules just left the game, and that is a
     question only `reduce` can answer. Paced, it only schedules the first
     tick; unpaced, it runs to the end now. */
  function runPolicy(){
    if(!o.policy) return;
    run = 0;
    if(paced){ schedule(paceOf(null, null, state)); return; }
    while(policyStep());
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
    const prev = state;
    state = out.state; seq++; stats.sent++;
    heard(seat, a, prev);
    /* paced, the player's own move shows at once and the other seat answers tick by tick */
    if(paced){ push(); runPolicy(); }
    else { runPolicy(); push(); }
    return null;
  }

  /* Called once by the board when it mounts. The other seat may be ON THE
     PLAY, in which case the game must not sit waiting for a player whose
     turn it is not — this is the same thing `Battle`'s opponent-first
     opening does, and forgetting it is a board that looks frozen. */
  function start(){
    if(!state) return;
    status = "ready";
    if(paced){ push(); runPolicy(); }
    else { runPolicy(); push(); }
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
    /* PACED (v7.18): whether the other seat has a tick waiting; NUDGE runs it now (a tap that
       dismisses the announcement brings the next play forward: nobody waits on an animation);
       DISPOSE drops it (the board unmounting) */
    busy:    () => tick != null,
    nudge:   () => { if(tick != null){ cancel(tick); tick = null; policyTick(); } },
    dispose: () => { if(tick != null){ cancel(tick); tick = null; } },
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

   AGAINST PEOPLE (v3, worker AF). A finished FRIENDLY or direct table game
   against a person is kept apart, under `pvp`: {mine: {<hero key>: {w,l,d}},
   foes: {<hero key>: {w,l,d}}, seen: [<game id>, ...]}. Opponents are filed by
   HERO only — never a name or an id of a person. `seen` is the last few game
   ids this phone already counted (a reconnect, a rejoin or a replayed end state
   must not count a game twice); ids are table code + the two seed halves, which
   name a deal, not a person. RANKED games are NOT recorded here: the server
   keeps them (the Ranked card on the Record tab), so counting them here too
   would show one game twice. A v2 record migrates on load without a write.

   Shape, under RECORD_KEY:
     {v: 3, foes: {<hero key>: {sharp: {w, l, d}, steady: {w, l, d}}},
            mine: {<hero key | "unknown">: {w, l, d}}}
   `foes` is the record by opponent, as ever. `mine` is the same games read by
   the hero the PLAYER piloted. A v1 record (foes only) migrates on load with
   nothing lost: every v1 game stays in `foes` and is counted once under the
   "unknown" bucket of `mine`, which the screen never shows as a hero name.
   Only pairs that were played appear. Anything else found there (another
   version, a hand edit, a half-written value) reads as empty rather than as
   a number nobody counted. */
const RECORD_KEY = "dawnblade.aiRecord";
const LEVELS = ["sharp", "steady"];
const OUTCOMES = ["w", "l", "d"];
const UNKNOWN_HERO = "unknown";
const SEEN_CAP = 40;
const count = n => (Number.isInteger(n) && n >= 0 ? n : 0);

/* what one finished game was, from `mySeat`'s side: "w" | "l" | "d", or null
   while there is no result (an unfinished or abandoned game) */
function outcomeOf(over, mySeat){
  if(!over || typeof over !== "object") return null;
  if(over.winner === null || over.winner === undefined) return over.how ? "d" : null;
  return over.winner === mySeat ? "w" : "l";
}

const cleanPvp = p => {
  const out = {mine: {}, foes: {}, seen: []};
  if(!p || typeof p !== "object") return out;
  for(const side of ["mine", "foes"]){
    const src = p[side]; if(!src || typeof src !== "object") continue;
    for(const k of Object.keys(src)){
      const c = src[k]; if(!c || typeof c !== "object" || k === UNKNOWN_HERO) continue;
      const n = {w: count(c.w), l: count(c.l), d: count(c.d)};
      if(n.w + n.l + n.d) out[side][k] = n;
    }
  }
  if(Array.isArray(p.seen)) out.seen = p.seen.filter(x => typeof x === "string" && x && x.length <= 200).slice(-SEEN_CAP);
  return out;
};

/* a clean copy (always v:3): known heroes' known levels, non-negative whole
   counts; a v1 record is migrated, its games filed under "unknown"; v1 and v2
   have no `pvp`, which reads empty */
function cleanRecord(r){
  const out = {v: 3, foes: {}, mine: {}, pvp: cleanPvp(r && r.v === 3 ? r.pvp : null)};
  if(!r || typeof r !== "object" || (r.v !== 1 && r.v !== 2 && r.v !== 3) || !r.foes || typeof r.foes !== "object") return out;
  for(const k of Object.keys(r.foes)){
    const f = r.foes[k]; if(!f || typeof f !== "object") continue;
    for(const lv of LEVELS){
      const c = f[lv]; if(!c || typeof c !== "object") continue;
      (out.foes[k] = out.foes[k] || {})[lv] = {w: count(c.w), l: count(c.l), d: count(c.d)};
    }
  }
  if(r.v === 1){
    const sum = {w: 0, l: 0, d: 0};
    for(const k of Object.keys(out.foes)) for(const lv of LEVELS){
      const c = out.foes[k][lv]; if(c){ sum.w += c.w; sum.l += c.l; sum.d += c.d; }
    }
    if(sum.w + sum.l + sum.d) out.mine[UNKNOWN_HERO] = sum;
  } else if(r.mine && typeof r.mine === "object"){
    for(const k of Object.keys(r.mine)){
      const c = r.mine[k]; if(!c || typeof c !== "object") continue;
      const n = {w: count(c.w), l: count(c.l), d: count(c.d)};
      if(n.w + n.l + n.d) out.mine[k] = n;
    }
  }
  return out;
}

/* a NEW record with exactly one counter one higher in `foes` and one in
   `mine` (filed under "unknown" when the player's hero is not given); the
   input is untouched. An unknown level or outcome, or no foe, changes nothing. */
function bumpRecord(r, foeKey, level, outcome, myKey){
  const out = cleanRecord(r);
  if(!foeKey || typeof foeKey !== "string" || !LEVELS.includes(level) || !OUTCOMES.includes(outcome)) return out;
  const f = out.foes[foeKey] = out.foes[foeKey] || {};
  const c = f[level] = f[level] || {w: 0, l: 0, d: 0};
  c[outcome] += 1;
  const mk = myKey && typeof myKey === "string" ? myKey : UNKNOWN_HERO;
  const m = out.mine[mk] = out.mine[mk] || {w: 0, l: 0, d: 0};
  m[outcome] += 1;
  return out;
}

/* a NEW record with one game against a PERSON counted: `mine` under the hero
   the player piloted, `foes` under the hero the person did (both by hero only),
   and the game's id remembered. Answers the same record when the id was
   already counted, or the game has no result, or no hero on either side. */
function bumpPvp(r, foeKey, outcome, myKey, gameId){
  const out = cleanRecord(r);
  if(!OUTCOMES.includes(outcome) || !foeKey || typeof foeKey !== "string" || foeKey === UNKNOWN_HERO) return out;
  if(!myKey || typeof myKey !== "string" || myKey === UNKNOWN_HERO) return out;
  if(!gameId || typeof gameId !== "string" || out.pvp.seen.includes(gameId)) return out;
  const bump = (m, k, o) => { const c = m[k] = m[k] || {w: 0, l: 0, d: 0}; c[o] += 1; };
  bump(out.pvp.mine, myKey, outcome);
  bump(out.pvp.foes, foeKey, outcome);
  out.pvp.seen = out.pvp.seen.concat(gameId).slice(-SEEN_CAP);
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
function recordResult(getStorage, foeKey, sharp, over, mySeat, myKey){
  const o = outcomeOf(over, mySeat);
  if(!o || !foeKey) return null;
  const r = bumpRecord(loadRecord(getStorage), foeKey, sharp ? "sharp" : "steady", o, myKey);
  saveRecord(getStorage, r);
  return r;
}

/* the board's call for a game against a person: read, bump, write. Null when
   nothing was counted (no result, already counted, a ranked game, missing
   heroes); else the record now held. The storage write is the one commit of
   the count AND the id, so a game is never counted without being remembered. */
function recordPvp(getStorage, foeKey, over, mySeat, myKey, gameId){
  const o = outcomeOf(over, mySeat);
  if(!o) return null;
  const before = loadRecord(getStorage);
  const after = bumpPvp(before, foeKey, o, myKey, gameId);
  if(JSON.stringify(after.pvp) === JSON.stringify(before.pvp)) return null;
  saveRecord(getStorage, after);
  return after;
}

return {createLocal, STEP_LIMIT,
        RECORD_KEY, UNKNOWN_HERO, SEEN_CAP, outcomeOf, cleanRecord, bumpRecord, bumpPvp, recordPvp, loadRecord, saveRecord, recordResult};
});
