/* test/helpers/pagedeal.js — THE DEAL, THE PAGE'S WAY (index.html JudgeRoom.deal), for drives of a server table.

   net.js's handshake compares catalog hashes, and a card object carries its image address, which the page builds from
   window.CDN: so the CDN address is the page's, and the catalog comes from the BUILDS' own cards (what the page's guest
   derives), not from the dealt state. A hosted function must deal the same way (server/supabase/entry.template.ts does).
   Used by tools/serverpage.js and tools/supabase-rehearse.js. */
const T = require("./judgetable.js");
const Wr = require("../../engine/wire.js");
const B_ = require("../../engine/build.js"), G_ = require("../../engine/game.js"), J_ = T.J, HJ_ = require("./judged.js");
require("../../engine/cards.js").setCDN("https://legendstory-production-s3-public.s3.amazonaws.com/media/cards/normal/");

const HEROES_ = Object.fromEntries(T.W.HEROES.map(h => [h.k, h]));
const DECKS_ = Object.fromEntries(T.W.HEROES.filter(h => T.W.DECKS[h.k]).map(h => [h.k, G_.parseDeck(T.W.DECKS[h.k])]));
const dealLikeThePage = spec => {
  const m = B_.buildMatch(spec, {db: HJ_.db(), heroes: HEROES_, decks: DECKS_});
  const state = J_.newMatch({builds: m.builds, names: m.names, heroKeys: m.heroKeys, first: m.first, seed: m.seed});
  const catalog = Wr.makeCatalog(m.builds.flatMap(b => [...(b.deck || []), ...(b.gear || []), ...(b.startItem ? [b.startItem.card] : [])]));
  return {state, catalog};
};
/* the catalog a blind guest derives for a spec */
const matchCatalog = spec => dealLikeThePage({...spec, seed: "blind|" + spec.seedC}).catalog;
module.exports = {dealLikeThePage, matchCatalog};
