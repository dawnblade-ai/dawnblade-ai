/* Repro: an opt resolved by SEAT 1 is addressed to seat 0 and reads seat 0's deck. */
const root = process.argv[2];
const H = require(root + "/test/helpers/judged.js");
const J = H.J; const PM = require(root + "/engine/prompts.js");
H.db();
const mine = ["Wild Ride","Buckwild","Bare Fangs","Rough Up"].map(n=>H.card(n,1)).filter(Boolean);
const theirs = ["Cindering Foresight","Photon Splicing","Look Tuff","Frost Spike"].map(n=>H.card(n,1)||H.card(n,3)).filter(Boolean);
for(const [seat, kind] of [[0,"opt"],[1,"opt"],[1,"lookOrder"]]){
  let g = H.state({deck: mine.map((c,i)=>({...c, uid:100+i}))}, {deck: theirs.map((c,i)=>({...c, uid:200+i}))},
                  {actor: seat, turnPlayer: seat, turn: 1});
  g = H.runOps(g, [[kind, 3]], "Whisper of the Oracle");
  const live = g.prompt || (g.promptQ && g.promptQ[0] && PM.buildPrompt(g, g.promptQ[0]));
  console.log(`actor ${seat} ${kind}: prompt.side=${live && live.side} cards=${live && live.cards.map(c=>c.name).join(", ")}`);
}
