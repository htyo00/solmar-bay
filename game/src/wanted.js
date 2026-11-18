// Wanted stars: crimes raise them, real evasion lowers them.
// A star only falls after sustained hiding: no police close AND no line
// of sight. While hidden-but-wanted the stars flash (search phase).
import { CFG } from './config.js';
import { hasSight } from './city.js';
import { dist2 } from './random.js';

export function createWanted(G) {
  const W = {
    stars: 0,
    cool: 0,
    seen: false,
    searching: false,
  };

  function addStars(n) {
    if (W.stars >= CFG.maxStars) return;
    W.stars = Math.min(CFG.maxStars, W.stars + n);
    W.cool = 0;
    W.searching = false;
  }

  function anySeesPlayer() {
    const p = G.player.pos;
    for (const c of G.police.cruisers) {
      if (dist2(c.pos.x, c.pos.z, p.x, p.z) > CFG.sightRange * CFG.sightRange) continue;
      if (hasSight(c.pos.x, c.pos.z, p.x, p.z, G.world.solids)) return true;
    }
    for (const c of G.police.foot) {
      if (dist2(c.pos.x, c.pos.z, p.x, p.z) > CFG.sightRangeFoot * CFG.sightRangeFoot) continue;
      if (hasSight(c.pos.x, c.pos.z, p.x, p.z, G.world.solids)) return true;
    }
    return false;
  }

  function update(dt) {
    if (W.stars <= 0) { W.seen = false; W.searching = false; W.cool = 0; return; }
    W.seen = anySeesPlayer();
    if (W.seen) {
      W.cool = 0;
      W.searching = false;
      return;
    }
    // hidden: the search phase. Stars fall one at a time, slowly.
    W.searching = true;
    W.cool += dt;
    if (W.cool >= CFG.hiddenPerStar) {
      W.cool = 0;
      W.stars -= 1;
      if (W.stars <= 0) {
        W.stars = 0;
        W.searching = false;
        G.police.standDown();
      }
    }
  }

  W.addStars = addStars;
  W.update = update;
  return W;
}
