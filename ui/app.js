/* ============================================================
   ui/app.js — DawnUIApp: the screen router. Only the table exists so far (README "Next" 2); the flow screens
   (title, hero, sit down, result) arrive at step 7 and this is where they plug in. `mount(el)` is called by
   boot.js once the phone contract is set. A failed deal is said on screen, in words, never as a blank page.
   `DawnUIApp.session()` is the live session (drives and the console reach it there; nothing in the UI does).
   ============================================================ */
(function(root, factory){
  if(typeof module === "object" && module.exports) module.exports = factory(root);
  else root.DawnUIApp = factory(root);
})(typeof self !== "undefined" ? self : this, function(root){

let current = null;

function Failed(p){
  const html = root.htmPreact.html;
  return html`<div class="stage fail" data-state="failed">
    <div class="failbox"><b>The table could not be dealt.</b><p>${p.why}</p><a class="classic" href="index.html">Classic board</a></div>
  </div>`;
}

function mount(el){
  const P = root.htmPreact, html = P.html;
  let node;
  try {
    current = root.DawnUISession.openLocal({});
    node = html`<${root.DawnUITable.Live} session=${current}/>`;
  } catch(e){
    node = html`<${Failed} why=${String(e && e.message || e)}/>`;
  }
  P.render(node, el);
  if(current) current.start();
  return current;
}

return {mount, session: () => current};
});
