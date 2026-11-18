// Combat: fists on foot, cars as weapons. Punching a cop is a bad idea.
import { dist2 } from './random.js';

export function createCombat(G) {
  let cd = 0;

  function punch() {
    if (cd > 0 || G.player.inCar) return;
    cd = 0.45;
    G.audio.punch();
    const p = G.player.pos;
    const fx = -Math.sin(G.player.heading), fz = -Math.cos(G.player.heading);
    // nearest ped in front
    let best = null, bd = 2.4 * 2.4;
    for (const ped of G.peds.peds) {
      if (ped.down > 0) continue;
      const dx = ped.pos.x - p.x, dz = ped.pos.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd && dx * fx + dz * fz > 0) { best = ped; bd = d2; }
    }
    if (best) {
      best.down = 6;
      G.wanted.addStars(1);
      G.hud.flash('ASSAULT — 1 STAR');
      return;
    }
    // nearest foot cop in front
    for (const cop of G.police.foot) {
      const dx = cop.pos.x - p.x, dz = cop.pos.z - p.z;
      if (dx * dx + dz * dz < 6 && dx * fx + dz * fz > 0) {
        G.wanted.addStars(1);
        G.hud.flash('YOU HIT A COP — 1 STAR');
        return;
      }
    }
  }

  function update(dt) {
    if (cd > 0) cd -= dt;
    // the player's car running over a ped: they go down, the law notices
    if (G.player.inCar && G.player.car) {
      const c = G.player.car;
      if (Math.abs(c.speed) > 4) {
        for (const ped of G.peds.peds) {
          if (ped.down > 0) continue;
          if (dist2(c.pos.x, c.pos.z, ped.pos.x, ped.pos.z) < 6.5) {
            ped.down = 8;
            if (!c.pedCd || c.pedCd <= 0) {
              c.pedCd = 2;
              G.wanted.addStars(1);
              G.hud.flash('PEDESTRIAN DOWN — 1 STAR');
            }
          }
        }
      }
      if (c.pedCd > 0) c.pedCd -= dt;
    }
  }

  return { punch, update };
}
