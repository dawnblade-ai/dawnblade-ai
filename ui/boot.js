/* ============================================================
   ui/boot.js — DawnUIBoot: the phone contract's ONE place (docs/crescendo/PHONE.md rules 2, 3, 8, 9; FRAMEWORK.md 4.3).
   It owns:
     --vh        the visible height in px, from visualViewport (innerHeight where there is none), set in one
                 rAF-throttled listener. Nothing else in ui/ reads a viewport size.
     data-band   compact | regular | tall on <html> (DESIGN-SYSTEM / SCREENS-TABLE 14): what the design changes per height.
     --vw        only with ?w=&h= (a desktop frame for looking at a phone-sized page); a phone never gets it.
     press state a `pressed` class on pointerdown for every [data-tap] / .btn, cleared on release: iOS :active is
                 unreliable without a touch listener on the document (PHONE rule 9), so a passive no-op is kept too.
   Then it mounts the app. Loaded LAST by play.html.
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUIBoot = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

/* the band, from the visible box: height in design px at 393 wide (FRAMEWORK.md 4.3) */
function bandOf(w, h){
  const hd = h * 393 / w;
  return hd < 600 ? "compact" : hd >= 760 ? "tall" : "regular";
}

function start(){
  const doc = root.document, r = doc.documentElement, q = new URLSearchParams(root.location.search);
  const framed = q.has("w") || q.has("h");
  let raf = 0;
  function set(){
    raf = 0;
    const vv = root.visualViewport;
    const w = framed ? +(q.get("w") || 393) : (vv ? vv.width : root.innerWidth);
    const h = framed ? +(q.get("h") || 660) : (vv ? vv.height : root.innerHeight);
    r.style.setProperty("--vh", h + "px");
    if(framed) r.style.setProperty("--vw", w + "px");
    r.setAttribute("data-band", bandOf(w, h));
    if(framed) r.setAttribute("data-framed", ""); else r.removeAttribute("data-framed");
  }
  set();
  if(!framed){
    const on = () => { if(!raf) raf = root.requestAnimationFrame(set); };
    (root.visualViewport || root).addEventListener("resize", on);
    root.addEventListener("orientationchange", on);
    root.addEventListener("pageshow", on);
  }

  /* PRESS: a class within the frame of the touch; the action itself fires on pointerup elsewhere */
  doc.addEventListener("touchstart", function(){}, {passive: true});
  let held = null;
  const release = () => { if(held){ held.classList.remove("pressed"); held = null; } };
  doc.addEventListener("pointerdown", e => {
    const t = e.target && e.target.closest ? e.target.closest("[data-tap], .btn") : null;
    release();
    if(t){ held = t; t.classList.add("pressed"); }
  }, true);
  ["pointerup", "pointercancel", "dragstart", "contextmenu"].forEach(n => doc.addEventListener(n, release, true));
  root.addEventListener("blur", release);

  if(root.DawnUIApp && root.DawnUIApp.mount) root.DawnUIApp.mount(doc.getElementById("app"));
}

if(typeof document !== "undefined" && root.document && !(typeof module === "object" && module.exports)) start();

return {bandOf, start};
});
