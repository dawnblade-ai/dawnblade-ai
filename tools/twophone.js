#!/usr/bin/env node
/* ============================================================
   tools/twophone.js — TWO REAL PAGES AT ONE TABLE (HIDDEN HANDS H2)

   tools/page.js drives one page; a two-phone table needs two, and a peer
   network the sandbox cannot reach. So PeerJS is STUBBED in each page
   (window.Peer, which engine/room.js uses when it exists) and every frame is
   relayed through node. Everything else is the real index.html and engine,
   loaded from file:// with page.js's offline routes.

   It walks the whole flow: open a table, join it, pick heroes, the SEALED
   throw (a tie, then a win), the seating, both loadouts, the seed exchange,
   then plays the game out — each page submitting for its own seat through
   its own session (the rule policy on the host's full game, and on the
   guest's VIEW) — and reports: the guest's view fingerprint against the
   referee's view of the host's game, whether the guest's phone holds the
   foe's hand, deck or seed, the host's saved game, the host-drop pause, and
   the post-game reveal. Page errors are listed at the end.

     PAGE_DEPS=<deps> NODE_PATH=<deps>/node_modules:$(npm root -g) node tools/twophone.js
     ... node tools/twophone.js judge      THREE pages: a judged table (H3)
   (deps: tools/page.js's header). A measuring drive, not a drill.

   JUDGE MODE (HIDDEN HANDS H3): a third page taps "Judge a table" and holds
   the deck; both players join it and are guests. The drive checks each
   phone's view against the judge's referee view of THAT seat, that neither
   phone holds the other's hand or deck, the judge's screen shows only the
   public view, a PLAYER's drop and rejoin (by its seat key), the JUDGE's
   reload and "Resume judging", and the reveal + Verify on BOTH phones.
   ============================================================ */
const path = require("path"), {pathToFileURL} = require("url");
const P = require("./page.js");
const {chromium} = require("playwright");
const INDEX = path.join(__dirname, "..", "index.html");
const STUB = `(() => {
  const mk = () => ({open:false, h:{}, on(e,f){ (this.h[e]=this.h[e]||[]).push(f); }, emit(e,...a){ (this.h[e]||[]).forEach(f=>f(...a)); },
    send(m){ window.__relay(JSON.stringify(m)); }, close(){ this.open=false; window.__relayClose(); }});
  window.Peer = class { constructor(id){ this.h={}; window.__peer=this; if(id) window.__peerId=id; setTimeout(()=>this.emit("open", id||"guest"), 20); }
    on(e,f){ (this.h[e]=this.h[e]||[]).push(f); } emit(e,...a){ (this.h[e]||[]).forEach(f=>f(...a)); }
    connect(id){ const c = mk(); window.__conn = c; setTimeout(()=>window.__relayDial(), 20); return c; } destroy(){} };
  window.__accept = () => { const c = mk(); window.__conn = c; window.__peer.emit("connection", c); c.open = true; c.emit("open"); };
  window.__opened = () => { window.__conn.open = true; window.__conn.emit("open"); };
  window.__deliver = s => window.__conn && window.__conn.emit("data", JSON.parse(s));
  window.__closed = () => window.__conn && window.__conn.emit("close");
})();`;
(async () => {
  if(process.argv[2] === "judge") return judgeRun();
  const answer = P.makeAnswer(P.depsDir());
  const browser = await chromium.launch();
  const errors = [];
  const pages = [];
  for(const who of ["host", "guest"]){
    const ctx = await browser.newContext({viewport: {width: 393, height: 852}, isMobile: true, hasTouch: true});
    await ctx.route(/^https?:/, route => { const req = route.request(), r = answer(req.url(), req.resourceType());
      route.fulfill({status: r.status || 200, contentType: r.contentType, body: r.body, headers: {"access-control-allow-origin": "*"}}); });
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push(who + " pageerror: " + String(e.stack || e).split("\n").slice(0, 3).join(" | ")));
    page.on("console", m => { if(m.type() === "error") errors.push(who + " console: " + m.text()); });
    await page.addInitScript(STUB);
    pages.push(page);
  }
  const [H, Gp] = pages;
  const other = p => p === H ? Gp : H;
  let frames = 0;
  for(const p of pages){
    await p.exposeFunction("__relay", s => { frames++; other(p).evaluate(x => window.__deliver(x), s).catch(e => errors.push("relay " + e.message)); });
    await p.exposeFunction("__relayDial", () => { H.evaluate(() => window.__accept()).then(() => Gp.evaluate(() => window.__opened())); });
    await p.exposeFunction("__relayClose", () => other(p).evaluate(() => window.__closed()));
  }
  for(const p of pages){
    await p.goto(pathToFileURL(INDEX).href);
    await p.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, {timeout: 30000});
  }
  const btn = (p, re) => p.locator("button", {hasText: re}).first();
  for(const p of pages){ await btn(p, /^Find an opponent/).click(); await p.waitForSelector(".tblwrap"); }
  await btn(H, /OPEN A TABLE/i).click();
  await H.waitForFunction(() => window.__peer, null, {timeout: 5000});
  await H.waitForTimeout(300);
  const code = await H.evaluate(() => String(window.__peerId).split("-").pop());
  console.log("table", code);
  await btn(Gp, /^Join a table/i).click();
  await Gp.locator("input.tblin").pressSequentially(code); console.log("typed", await Gp.locator("input.tblin").inputValue());
  await Gp.locator(".tblwrap button.bigbtn").first().click();
  for(const p of pages) await p.waitForSelector(".lobheroes", {timeout: 10000});
  /* heroes */
  await H.locator(".lobhero", {hasText: "Kayo"}).first().click(); await btn(H, /^Lock in/).click();
  await Gp.locator(".lobhero", {hasText: "Azalea"}).first().click(); await btn(Gp, /^Lock in/).click();
  /* throw: a tie first, then paper beats rock */
  const throwRound = async (a, b) => { await H.waitForSelector(".rthrows button"); await Gp.waitForSelector(".rthrows button");
    await H.locator(".rthrows button", {hasText: a}).click(); await Gp.locator(".rthrows button", {hasText: b}).click(); await H.waitForTimeout(400); };
  await throwRound("rock", "rock");
  await throwRound("paper", "rock");
  await H.waitForSelector(".rseatpick button", {timeout: 8000});
  console.log("host won the throw, seats");
  await H.locator(".rseatpick button").first().click();
  for(const p of pages){ await p.waitForSelector(".battlebtn", {timeout: 10000}); await p.locator(".battlebtn").first().click(); }
  for(const p of pages) await p.waitForSelector(".actbar", {timeout: 15000});
  await Gp.waitForFunction(() => window.__dawnTable && window.__dawnTable.session.status() === "ready", null, {timeout: 10000});
  const info = async () => ({
    host: await H.evaluate(() => { const s = window.__dawnTable.session; return {status: s.status(), seq: s.seq(), referee: !!s.isReferee,
      guestWant: DawnWire.hash(DawnReferee.seatView(s.full(), 1))}; }),
    guest: await Gp.evaluate(() => { const s = window.__dawnTable.session, v = s.state(); return {status: s.status(), seq: s.seq(), hash: s.hash(),
      viewSeat: v.viewSeat, foeHandHidden: v.sides[0].hand.every(c => DawnView.isPh(c) || (v.sides[0].blockH || []).concat(v.sides[0].paySel || []).includes(c.uid) || (v.pending && v.pending.card && v.pending.card.uid === c.uid)), foeDeckHidden: v.sides[0].deck.filter(c=>!c._kb).every(c => DawnView.isPh(c)),
      rngHidden: !!v.rng.hidden, ownHand: v.sides[1].hand.map(c => c.name).length}; })});
  let x = await info(); console.log(JSON.stringify(x));
  /* play: each phone submits for its own seat through its own session */
  let acts = 0;
  const play = async limit => {
    for(let i = 0; i < limit; i++){
      const done = await H.evaluate(() => !!window.__dawnTable.session.full().over);
      if(done) return true;
      const hostMoved = await H.evaluate(() => { const s = window.__dawnTable.session, a = DawnSparring.act(s.full(), 0, {search: false}); if(!a) return false; return s.submit(a) || true; });
      if(hostMoved === true){ acts++; await H.waitForTimeout(5); continue; }
      if(hostMoved) { console.log("host refused", hostMoved); return false; }
      const g = await Gp.evaluate(() => { const s = window.__dawnTable.session, a = DawnSparring.act(s.state(), 1, {search: false}); if(!a) return false; return s.submit(a) || true; });
      if(g === true){ acts++; await Gp.waitForTimeout(15); continue; }
      if(g){ await Gp.waitForTimeout(50); continue; }
      await Gp.waitForTimeout(50);
    }
    return false;
  };
  await play(80);
  await Gp.waitForTimeout(400);
  x = await info(); console.log("after", acts, "actions:", JSON.stringify(x), "agree:", x.guest.hash === x.host.guestWant);
  console.log("host saved:", await H.evaluate(() => Object.keys(localStorage).filter(k => /dawnblade.table/.test(k)).map(k => k + " " + localStorage.getItem(k).length)));

  /* THE HOST'S PHONE RELOADS mid-game: its channel dies with the page */
  const seqAt = x.host.seq;
  await Gp.evaluate(() => window.__closed());
  await H.reload();
  await H.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, {timeout: 30000});
  await Gp.waitForTimeout(1600);
  console.log("guest while the host is gone:", await Gp.evaluate(() => window.__dawnTable.session.status()), "·",
    await Gp.evaluate(() => window.__dawnTable.session.submit({t: "pass"})), "· banner:",
    await Gp.evaluate(() => { const e = [...document.querySelectorAll(".tblerr")].find(d => /paused/.test(d.innerText)); return e ? e.innerText.slice(0, 60) : null; }));
  /* the host reopens the same table from what it saved */
  await btn(H, /^Find an opponent/).click(); await H.waitForSelector(".tblwrap");
  await btn(H, /^Resume table/).click();
  await H.waitForTimeout(300);
  /* the guest rejoins (the host's table opens when a guest sits down) */
  await btn(Gp, /^Rejoin$/).click();
  await H.waitForFunction(() => window.__dawnTable && window.__dawnTable.session && window.__dawnTable.session.full, null, {timeout: 15000});
  console.log("host resumed at seq", await H.evaluate(() => window.__dawnTable.session.seq()), "(saved at " + seqAt + ")");
  await Gp.waitForFunction(() => window.__dawnTable.session.status() === "ready", null, {timeout: 10000});
  x = await info(); console.log("after rejoin:", JSON.stringify(x.guest), "agree:", x.guest.hash === x.host.guestWant);
  const finished = await play(4000);
  await Gp.waitForTimeout(800);
  x = await info(); console.log("finished:", finished, "after", acts, "actions · agree:", x.guest.hash === x.host.guestWant);
  console.log("revealed:", await Gp.evaluate(() => { const r = window.__dawnTable.session.revealed(); return r ? r.log.length + " log entries, seedH " + !!r.seedH : null; }));
  /* VERIFY THIS GAME, tapped on the guest's phone */
  if(await Gp.locator("button", {hasText: /^Verify this game/}).count()){
    await btn(Gp, /^Verify this game/).click();
    await Gp.waitForFunction(() => /Verified:|Not verified:/.test(document.body.innerText), null, {timeout: 60000});
    console.log("verdict:", await Gp.evaluate(() => (document.body.innerText.match(/(Verified:|Not verified:)[^\n]*/) || [""])[0]));
  } else console.log("verdict: no verify button");
  console.log("host saved after the end:", await H.evaluate(() => Object.keys(localStorage).filter(k => /dawnblade.table/.test(k)).length));
  console.log("frames", frames, "ERRORS", errors.length); errors.slice(0, 10).forEach(e => console.log("  " + e));
  await browser.close();
})().catch(e => { console.error("DRIVE FAILED", e); process.exit(1); });

/* ---- THREE PAGES: a judged table (HIDDEN HANDS H3) ------------------------ */
const STUB3 = `(() => {
  const mk = k => ({open:false, h:{}, k, on(e,f){ (this.h[e]=this.h[e]||[]).push(f); }, emit(e,...a){ (this.h[e]||[]).forEach(f=>f(...a)); },
    send(m){ window.__relay(JSON.stringify(m), this.k); }, close(){ this.open=false; window.__relayClose(this.k); }});
  window.__conns = {};
  window.Peer = class { constructor(id){ this.h={}; window.__peer=this; if(id) window.__peerId=id; setTimeout(()=>this.emit("open", id||"guest"), 20); }
    on(e,f){ (this.h[e]=this.h[e]||[]).push(f); } emit(e,...a){ (this.h[e]||[]).forEach(f=>f(...a)); }
    connect(id){ const c = mk(null); window.__conn = c; setTimeout(()=>window.__relayDial(), 20); return c; } destroy(){} };
  window.__accept = k => { const c = mk(k); window.__conns[k] = c; window.__peer.emit("connection", c); c.open = true; c.emit("open"); };
  window.__opened = () => { window.__conn.open = true; window.__conn.emit("open"); };
  window.__deliver = (s, k) => { const c = k == null ? window.__conn : window.__conns[k]; if(c) c.emit("data", JSON.parse(s)); };
  window.__closed = k => { const c = k == null ? window.__conn : window.__conns[k]; if(c){ c.open = false; c.emit("close"); } };
})();`;
async function judgeRun(){
  const answer = P.makeAnswer(P.depsDir());
  const browser = await chromium.launch();
  const errors = [];
  const mkPage = async who => {
    const ctx = await browser.newContext({viewport: {width: 393, height: 852}, isMobile: true, hasTouch: true});
    await ctx.route(/^https?:/, route => { const req = route.request(), r = answer(req.url(), req.resourceType());
      route.fulfill({status: r.status || 200, contentType: r.contentType, body: r.body, headers: {"access-control-allow-origin": "*"}}); });
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push(who + " pageerror: " + String(e.stack || e).split("\n").slice(0, 3).join(" | ")));
    page.on("console", m => { if(m.type() === "error") errors.push(who + " console: " + m.text()); });
    await page.addInitScript(STUB3);
    return page;
  };
  const Jp = await mkPage("judge"), A = await mkPage("A"), Bp = await mkPage("B");
  /* conn k on the judge's page <-> one guest page; a redial makes a new k */
  const link = new Map();      /* k -> guest page */
  const cur = new Map();       /* guest page -> its live k */
  let nextK = 0, frames = 0;
  const relayFrom = (p, s, k) => { frames++;
    if(p === Jp){ const g = link.get(k); if(g && cur.get(g) === k) g.evaluate(x => window.__deliver(x), s).catch(e => errors.push("relay " + e.message)); }
    else { const kk = cur.get(p); if(kk != null) Jp.evaluate(([x, q]) => window.__deliver(x, q), [s, kk]).catch(e => errors.push("relay " + e.message)); } };
  for(const p of [Jp, A, Bp]){
    await p.exposeFunction("__relay", (s, k) => relayFrom(p, s, k));
    await p.exposeFunction("__relayDial", async () => { const k = nextK++; link.set(k, p); cur.set(p, k);
      await Jp.evaluate(q => window.__accept(q), k); await p.evaluate(() => window.__opened()); });
    await p.exposeFunction("__relayClose", k => { if(p === Jp){ const g = link.get(k); if(g && cur.get(g) === k){ cur.delete(g); g.evaluate(() => window.__closed()).catch(()=>{}); } }
      else { const kk = cur.get(p); cur.delete(p); if(kk != null) Jp.evaluate(q => window.__closed(q), kk).catch(()=>{}); } });
  }
  const ready = p => p.waitForFunction(() => /\d+ cards/.test((document.querySelector(".topbar .tag") || {}).textContent || ""), null, {timeout: 30000});
  for(const p of [Jp, A, Bp]){ await p.goto(pathToFileURL(INDEX).href); await ready(p); }
  const btn = (p, re) => p.locator("button", {hasText: re}).first();
  for(const p of [Jp, A, Bp]){ await btn(p, /^Find an opponent/).click(); await p.waitForSelector(".tblwrap"); }
  console.log("honest line on the find screen:", await A.evaluate(() => /judge's device holds the deck/.test(document.body.innerText)));
  await btn(Jp, /^Judge a table/).click();
  await Jp.waitForSelector(".judgeroom", {timeout: 8000});
  const code = await Jp.evaluate(() => String(window.__peerId).split("-").pop());
  console.log("judged table", code);
  const join = async p => { await btn(p, /^Join a table/i).click(); await p.locator("input.tblin").pressSequentially(code);
    await p.locator(".tblwrap button.bigbtn").first().click(); await p.waitForSelector(".lobheroes", {timeout: 10000}); };
  await join(A); await join(Bp);
  const seatOf = p => p.evaluate(() => (document.querySelector(".tblseat") || {}).textContent || "");
  console.log("seats:", await seatOf(A), "|", await seatOf(Bp));
  await A.locator(".lobhero", {hasText: "Kayo"}).first().click(); await btn(A, /^Lock in/).click();
  await Bp.locator(".lobhero", {hasText: "Azalea"}).first().click(); await btn(Bp, /^Lock in/).click();
  const throwRound = async (a, b) => { await A.waitForSelector(".rthrows button"); await Bp.waitForSelector(".rthrows button");
    await A.locator(".rthrows button", {hasText: a}).click(); await Bp.locator(".rthrows button", {hasText: b}).click(); await A.waitForTimeout(500); };
  await throwRound("rock", "rock");
  await throwRound("paper", "rock");
  await A.waitForSelector(".rseatpick button", {timeout: 8000});
  await A.locator(".rseatpick button").first().click();
  for(const p of [A, Bp]){ await p.waitForSelector(".battlebtn", {timeout: 10000}); await p.locator(".battlebtn").first().click(); }
  for(const p of [A, Bp]) await p.waitForSelector(".actbar", {timeout: 15000});
  for(const p of [A, Bp]) await p.waitForFunction(() => window.__dawnTable && window.__dawnTable.session.status() === "ready", null, {timeout: 10000});
  const judgeInfo = () => Jp.evaluate(() => { const h = window.__dawnJudgeTable.hub, s = h.session(), f = s.full();
    const hid = s2 => new Set([...DawnView.hiddenUids(f, s2).keys()].map(String));
    const both = new Set([...hid(0)].filter(u => hid(1).has(u)));
    const toks = []; (function w(v){ if(v == null) return; if(Array.isArray(v)) return v.forEach(w); if(typeof v === "object") return Object.values(v).forEach(w); toks.push(String(v)); })(s.state());
    return {seq: s.seq(), over: f.over || null, want: [0, 1].map(x => DawnWire.hash(DawnReferee.seatView(f, x))),
            screenLeaks: toks.filter(u => both.has(u)).length,
            screen: (document.querySelector(".judgeroom") || {}).innerText || ""}; });
  const phone = p => p.evaluate(() => { const s = window.__dawnTable.session, v = s.state(), me = s.seat(), foe = v.sides[1 - me];
    return {seat: me, status: s.status(), seq: s.seq(), hash: s.hash(), full: !!s.full(),
      /* a face-up card in the other hand must be public by a mark: defending
         (blockH), picked to pitch (paySel), being played (pending), or KNOWN
         in hand after a reveal (_kh, game.js KNOWN_MARKS) */
      foeOpen: foe.hand.filter(c => !(DawnView.isPh(c) || (foe.blockH || []).concat(foe.paySel || []).includes(c.uid) || (v.pending && v.pending.card && v.pending.card.uid === c.uid))).map(c => c.name + (c._kh ? "(_kh)" : "")),
      foeHandHidden: foe.hand.every(c => DawnView.isPh(c) || c._kh || (foe.blockH || []).concat(foe.paySel || []).includes(c.uid) || (v.pending && v.pending.card && v.pending.card.uid === c.uid)),
      foeDeckHidden: foe.deck.filter(c => !c._kb && !c._kt).every(c => DawnView.isPh(c)), rngHidden: !!(v.rng && v.rng.hidden)}; });
  const report = async label => { const j = await judgeInfo(), a = await phone(A), b = await phone(Bp);
    const agree = [a, b].map(x => x.hash === j.want[x.seat]);
    console.log(label, JSON.stringify({seq: j.seq, agree, screenLeaks: j.screenLeaks,
      blind: [a, b].map(x => x.foeHandHidden && x.foeDeckHidden && x.rngHidden && !x.full ? true : [x.foeHandHidden, x.foeDeckHidden, x.rngHidden, !x.full].join("/")),
      faceUp: [a, b].map(x => x.foeOpen.join(",")),
      status: [a.status, b.status]})); return {j, a, b, agree}; };
  let x = await report("dealt:");
  console.log("judge screen says it holds the deck:", /This device holds the deck/.test(x.j.screen));
  let acts = 0;
  const play = async limit => {
    for(let i = 0; i < limit; i++){
      if(await Jp.evaluate(() => !!window.__dawnJudgeTable.hub.session().full().over)) return true;
      let moved = false;
      for(const p of [A, Bp]){
        const r = await p.evaluate(() => { const s = window.__dawnTable.session; if(s.status() !== "ready") return false;
          const a = DawnSparring.act(s.state(), s.seat(), {search: false}); if(!a) return false; return s.submit(a) || true; });
        if(r === true){ acts++; moved = true; await p.waitForTimeout(10); break; }
        if(r){ console.log("refused on its own view:", r); return false; }
      }
      if(!moved) await A.waitForTimeout(50);
    }
    return false;
  };
  await play(60); await A.waitForTimeout(400);
  x = await report("after " + acts + " actions:");
  /* A PLAYER'S PHONE LOSES ITS CHANNEL, then rejoins with its seat key */
  await Bp.evaluate(() => { window.__conn.close(); window.__closed(); });
  await Bp.waitForTimeout(1600);
  console.log("B while away:", (await phone(Bp)).status, "· banner:",
    await Bp.evaluate(() => { const e = [...document.querySelectorAll(".tblerr")].find(d => /paused/.test(d.innerText)); return e ? e.innerText.slice(0, 70) : null; }),
    "· judge screen:", ((await judgeInfo()).screen.match(/Seat 1[^\n]*/) || [""])[0]);
  await btn(Bp, /^Rejoin$/).click();
  await Bp.waitForFunction(() => window.__dawnTable.session.status() === "ready", null, {timeout: 10000});
  x = await report("B rejoined:");
  await play(40); await A.waitForTimeout(300);
  /* THE JUDGE'S DEVICE RELOADS mid-game */
  const seqAt = (await judgeInfo()).seq;
  for(const p of [A, Bp]) await p.evaluate(() => window.__closed());
  cur.clear();
  await Jp.reload(); await ready(Jp);
  await A.waitForTimeout(1600);
  console.log("phones while the judge is gone:", (await phone(A)).status, (await phone(Bp)).status, "·",
    await A.evaluate(() => window.__dawnTable.session.submit({t: "pass"})));
  await btn(Jp, /^Find an opponent/).click(); await Jp.waitForSelector(".tblwrap");
  await btn(Jp, /^Resume judging/).click();
  await Jp.waitForSelector(".judgeroom", {timeout: 8000});
  for(const p of [A, Bp]){ await btn(p, /^Rejoin$/).click(); await p.waitForFunction(() => window.__dawnTable.session.status() === "ready", null, {timeout: 10000}); }
  console.log("judge resumed at seq", (await judgeInfo()).seq, "(saved at " + seqAt + ")");
  x = await report("after the judge resumed:");
  const finished = await play(4000);
  await A.waitForTimeout(800);
  x = await report("finished " + finished + " after " + acts + " actions:");
  for(const [nm, p] of [["A", A], ["B", Bp]]){
    if(await p.locator("button", {hasText: /^Verify this game/}).count()){
      await btn(p, /^Verify this game/).click();
      await p.waitForFunction(() => /Verified:|Not verified:/.test(document.body.innerText), null, {timeout: 60000});
      console.log(nm, "verdict:", await p.evaluate(() => (document.body.innerText.match(/(Verified:|Not verified:)[^\n]*/) || [""])[0].slice(0, 90)),
        "· names the judge:", await p.evaluate(() => /The judge's device held the deck/.test(document.body.innerText)));
    } else console.log(nm, "verdict: no verify button");
  }
  console.log("judge saved after the end:", await Jp.evaluate(() => Object.keys(localStorage).filter(k => /dawnblade.judge/.test(k)).length));
  console.log("frames", frames, "ERRORS", errors.length); errors.slice(0, 10).forEach(e => console.log("  " + e));
  await browser.close();
}
