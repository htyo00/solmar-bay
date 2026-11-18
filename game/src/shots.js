// Screenshot setups: ?shot=chase|title|mission|complete stages a frozen
// frame of the game so the headless capture is stable and readable.
import { CFG } from './config.js';
import { PLACES } from './city.js';
import { createCar } from './vehicles.js';

export function applyShot(G, name) {
  G.shotMode = true;
  const P = G.player;
  if (name === 'title') {
    G.state = 'title';
    G.hud.showTitle();
    // Dante stands behind the camera here: the title shot is the city, not him
    P.pos.x = 200; P.pos.z = -200; P.heading = Math.PI * 0.75;
    return;
  }
  if (name === 'chase') {
    G.state = 'play';
    const comet = createCar(G, 'comet', 200, 40, Math.PI);
    comet.speed = 26;
    P.inCar = true; P.car = comet;
    G.missions.comet = comet;
    G.missions.step = 1;
    G.wanted.stars = 3;
    // two cruisers right on the bumper (between camera and player in frame)
    const c1 = createCar(G, 'cruiser', 200, 30, Math.PI);
    c1.speed = 24;
    const c2 = createCar(G, 'cruiser', 193, 33, Math.PI);
    c2.speed = 22;
    G.police.cruisers.push(c1, c2);
    P.pos.x = 200; P.pos.z = 40;
    G.hud.flash('3 STARS — LOSE THE COPS');
    return;
  }
  if (name === 'mission') {
    G.state = 'play';
    const comet = createCar(G, 'comet', PLACES.cometSpawn.x, PLACES.cometSpawn.z, PLACES.cometSpawn.heading);
    G.missions.comet = comet;
    // Dante close to the Comet, facing it, so one frame holds them both
    P.pos.x = 196; P.pos.z = -138;
    P.heading = -0.32;
    return;
  }
  if (name === 'complete') {
    G.state = 'play';
    // staged at the pier entrance: the deck runs ahead to the wheel in the
    // distance, the Comet center-frame, water on both sides
    const comet = createCar(G, 'comet', 238, PLACES.pierDrop.z, -Math.PI / 2);
    G.missions.comet = comet;
    G.missions.done = true;
    G.missions.grade = 'A';
    G.missions.paid = CFG.pay.A;
    G.save.cash += CFG.pay.A;
    G.save.jobs = 1;
    G.save.bestGrade = 'A';
    P.inCar = true; P.car = comet;
    P.pos.x = comet.pos.x; P.pos.z = comet.pos.z;
    G.hud.showComplete('A', CFG.pay.A, 96);
    return;
  }
  G.shotMode = false;
}
