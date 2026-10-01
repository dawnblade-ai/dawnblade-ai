/* ============================================================
   THE DEAD-TAP SWEEP (v4.88) — does every lit control DO something?

   A DEAD TAP is an ENABLED control that, tapped, changes nothing and says
   nothing. It reads as a broken screen rather than as a rule (v2.83), and
   no drill can see one: the trainer's doors are closures inside `Battle`,
   and a source scan cannot tell an enabled button in front of a silent
   guard from a working one (v4.85).

   For one hero it plays the opening, then taps every lit ⚡ tile and the
   hero-power button in the ACTION phase, then plays the cheapest attack
   and does the same in the player's own REACTION window. It reports each
   tap as `ok` (with the mode it reached and the first log line) or `DEAD`
   (with the state before and after).

     sh tools/phone/serve.sh "$SCRATCH"                 # once, then `refresh`
     NODE_PATH="$SCRATCH/node_modules" node tools/phone/deadtap.js Lyath
     NODE_PATH="$SCRATCH/node_modules" sh tools/phone/sweep.sh   # all fifteen

   IT FOUND FIVE DEFECTS AT v4.88 AND HAD FOUR OF ITS OWN, all kept
   here as the reason for the code that fixes them:

   - React state is read from `#root`'s CURRENT tree. A DOM node's fiber
     can be the stale ALTERNATE when the node persists across renders, and
     read through it a live tap reports as dead.
   - Rebuild the page (`serve.sh <dir> refresh`) after every edit. A sweep
     run against a copy older than the fix reports the fixed defect, and
     reads exactly like a fix that did not work.
   - A tap can open a SHEET, and every tap after it is then refused by
     `sheetFirst`. It answers an open sheet before the next tap (v4.89).
   - It must PITCH to pay for the attack it plays. Clicking the confirm
     alone left nine of fifteen heroes short of the reaction window, so
     their sweep covered one window of two while reporting clean (v4.89).

   It sweeps ⚡ tiles only. Weapon tiles, hand cards and the arsenal tile
   are routed by the same doors and are the obvious widening.
   ============================================================ */
let chromium;
try { ({ chromium } = require("playwright")); }
catch(e){ console.error("needs playwright — run tools/phone/serve.sh and set NODE_PATH to its node_modules"); process.exit(2); }
const hero = process.argv[2];
const URL = process.env.DEADTAP_URL || "http://127.0.0.1:8765/index.html";
const EXE = process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium";
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  const p = await b.newPage({ viewport: { width: 393, height: 852 } });
  const errs = [];
  p.on("pageerror", e => errs.push("PAGEERROR " + e.message));
  await p.goto(URL);
  await p.waitForTimeout(5000);
  /* case-insensitive: the loadout's labels are uppercase */
  const click = async re => {
    const bs = await p.$$("button");
    for(const x of bs){
      const t = (await x.innerText()).replace(/\s+/g, " ").trim();
      if(re.test(t) && await x.isVisible() && await x.isEnabled()){ await x.click(); return t; }
    }
    return null;
  };
  /* FROM THE ROOT'S CURRENT TREE — see the header */
  const state = () => p.evaluate(() => {
    const host = document.getElementById("root");
    const ck = Object.keys(host).find(k => k.startsWith("__reactContainer$"));
    if(!ck) return null;
    const root = host[ck];
    const stack = [root.stateNode && root.stateNode.current ? root.stateNode.current : root];
    while(stack.length){
      const f = stack.pop(); if(!f) continue;
      let h = f.memoizedState;
      while(h && typeof h === "object" && "next" in h){
        const v = h.memoizedState;
        if(v && typeof v === "object" && Array.isArray(v.sides) && v.sides.length === 2 && "mode" in v)
          return {mode: v.mode, log0: (v.log || [])[0], logN: (v.log || []).length,
                  res: v.sides[0].res, ap: v.sides[0].ap,
                  hand: v.sides[0].hand.map(c => ({name: c.name, tt: c.tt, cost: c.cost})),
                  used: JSON.stringify(v.sides[0].weaponUsed || {}),
                  gear: v.sides[0].gear.map(c => c.name + (c.destroyed ? "!" : "")).join(","),
                  stack: (v.stack || []).length, marked: !!v.sides[1].marked,
                  prompt: v.prompt ? v.prompt.tag : null};
        h = h.next;
      }
      if(f.sibling) stack.push(f.sibling);
      if(f.child) stack.push(f.child);
    }
    return null;
  });
  await click(new RegExp("^" + hero, "i")); await p.waitForTimeout(700);
  await click(/^BATTLE$/); await p.waitForTimeout(2000);
  /* the pregame has no game state yet, so loop until there is one */
  let s = null;
  for(let i = 0; i < 12 && !s; i++){
    (await click(/^I go first/i)) || (await click(/^FIGHT$/));
    await p.waitForTimeout(700); s = await state();
  }
  for(let i = 0; i < 14 && s && s.mode !== "act"; i++){
    await click(/^TAKE IT|Done defending|^Skip|^Decline|^Confirm|End turn|^Pass/i);
    await p.waitForTimeout(600); s = await state();
  }
  const same = (a, c) => a.mode === c.mode && a.log0 === c.log0 && a.logN === c.logN && a.res === c.res
                      && a.gear === c.gear && a.stack === c.stack && a.used === c.used && a.marked === c.marked;
  const sweep = async label => {
    const tiles = await p.$$eval("button", bs => bs.filter(x => x.offsetParent && !x.disabled && /⚡/.test(x.innerText))
                                                  .map(x => x.innerText.replace(/\s+/g, " ").trim()));
    for(const t of tiles){
      const before = await state();
      if(!before || before.mode !== (label === "act" ? "act" : "stack")) break;
      const loc = p.locator("button", {hasText: t.split(" · ")[0].split(" cost")[0].replace(/ ⚡.*/, "")})
                   .filter({hasText: "⚡"}).first();
      /* the hero-power button commits on one tap; a tile peeks, then commits */
      if(/⚡ USE|USED/.test(t)) await loc.click().catch(() => {});
      else { await loc.click().catch(() => {}); await p.waitForTimeout(250); await loc.click().catch(() => {}); }
      await p.waitForTimeout(900);
      const after = await state();
      const dead = after && same(before, after);
      if(dead) console.log("   before", JSON.stringify(before).slice(0, 300), "\n   after ", JSON.stringify(after).slice(0, 300));
      console.log((dead ? "DEAD " + (after.prompt ? "[under a live " + after.prompt + " sheet] " : "") : "ok   ")
                  + label.padEnd(6) + JSON.stringify(t).slice(0, 70)
                  + (dead ? "" : "  -> " + after.mode + " | " + String(after.log0).slice(0, 90)));
      if(after && (after.mode === "pay" || after.mode === "discpick")){ await click(/cancel/i); await p.waitForTimeout(300); }
      /* A TAP CAN OPEN A SHEET (Bull's Eye Bracers asks "Put an arrow face
         up in your arsenal?"), and every later tap is then refused by
         `sheetFirst` — correctly, and uselessly for a sweep. So the sheet
         is answered the cheapest way the board offers before the next
         tap. Without this the probe stalled until its timeout (v4.89). */
      /* DECLINE, THEN CONFIRM: on a `pick` "Choose none" only clears the
         selection and Confirm is what ends the sheet, so one regex for both
         re-clicks "Choose none" forever (it is first in the DOM). */
      for(let k = 0; k < 3; k++){
        const st = await state(); if(!st || !st.prompt) break;
        await click(/^Decline|^Choose none|^Skip/i); await p.waitForTimeout(300);
        await click(/^Confirm|^OK$|^Place none/i); await p.waitForTimeout(400);
      }
    }
  };
  if(!s || s.mode !== "act"){ console.log("NOACT", hero, s && s.mode); await b.close(); return; }
  await sweep("act");
  s = await state();
  if(s.mode === "act"){
    /* TRY EACH ATTACK IN TURN, cheapest first. The cheapest is not always
       playable from hand — an arrow is played from the arsenal — and a probe
       that gives up on the first candidate reports NOSTACK for a hand that
       held a perfectly good swing. */
    const cands = s.hand.filter(c => /Attack/.test(c.tt || "") && !/Reaction/.test(c.tt || "") && (c.cost || 0) <= s.res + 3)
                        .sort((a, c) => (a.cost || 0) - (c.cost || 0)).slice(0, 4);
    if(!cands.length) console.log("NOATTACK");
    let tried = [];
    for(const atk of cands){
      s = await state(); if(!s || s.mode !== "act") break;
      tried.push(atk.name);
      const l = p.locator(`text="${atk.name}"`).first();
      await l.click().catch(() => {}); await p.waitForTimeout(300); await l.click().catch(() => {}); await p.waitForTimeout(600);
      /* GET THE ATTACK ONTO THE CHAIN. A payment needs cards PITCHED first —
         "Pitch & play" refuses an uncovered cost rather than greying out —
         and selecting one is the same peek-then-commit pair of taps as
         playing one. Before v4.89 this only clicked the confirm, so nine of
         fifteen heroes never reached the reaction window and reported
         NOSTACK: a limit of the probe, not the page. */
      for(let i = 0; i < 10; i++){
        s = await state(); if(s.mode === "stack" || s.mode === "act") break;
        if(s.mode === "pay"){
          const pitch = s.hand.filter(c => c.name !== atk.name).map(c => c.name);
          for(const nm of pitch.slice(0, 3)){
            const h = p.locator(`text="${nm}"`).first();
            await h.click().catch(() => {}); await p.waitForTimeout(200); await h.click().catch(() => {}); await p.waitForTimeout(250);
          }
          await click(/^Pitch & play/i); await p.waitForTimeout(500);
          s = await state(); if(s.mode === "pay"){ await click(/cancel/i); await p.waitForTimeout(300); break; }
          continue;
        }
        await click(/^No boost|^Decline|^No charge|^No reveal|^Confirm|^Skip/i); await p.waitForTimeout(400);
      }
      s = await state();
      if(s.mode === "stack") break;
    }
    s = await state();
    if(s.mode === "stack") await sweep("stack");
    else if(cands.length) console.log("NOSTACK", tried.join(" / "), s.mode);
  }
  console.log("ERRS", JSON.stringify(errs.slice(0, 3)));
  await b.close();
})();
