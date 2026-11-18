// Builds the visible city: ground, roads, buildings, props, pier, water.
// Everything procedural: one canvas window texture, tinted per district.
import * as THREE from 'three';
import { CFG } from './config.js';
import { DISTRICTS, LANDMARKS, PLACES } from './city.js';
import { makeRng, range, pick, chance } from './random.js';

function windowTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#101018'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const lit = Math.random();
      if (lit < 0.42) g.fillStyle = pick(Math.random, ['#ffd27a', '#ffe9a8', '#7ae0ff', '#ff9ad5']);
      else g.fillStyle = '#1c1c28';
      g.fillRect(x, y, 9, 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#05050a'; g.fillRect(0, 0, 256, 64);
  g.font = 'bold 34px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18;
  g.fillStyle = color;
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export function buildWorld(scene) {
  const rng = makeRng(20261118);
  const group = new THREE.Group();
  scene.add(group);
  const solids = [];
  const winTex = windowTexture();
  const mats = {};
  for (const d of DISTRICTS) {
    mats[d.name] = new THREE.MeshLambertMaterial({
      color: d.tint, emissive: 0xffffff, emissiveMap: winTex, emissiveIntensity: 0.85,
    });
  }
  const asphalt = new THREE.MeshLambertMaterial({ color: 0x14141c });
  const walk = new THREE.MeshLambertMaterial({ color: 0x2a2a33 });
  const sand = new THREE.MeshLambertMaterial({ color: 0x8a7a55 });
  const waterMat = new THREE.MeshLambertMaterial({ color: 0x06283a, emissive: 0x0a3a55, emissiveIntensity: 0.5 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const gold = new THREE.MeshLambertMaterial({ color: 0xffc233, emissive: 0xa87800, emissiveIntensity: 0.8 });

  // ground: asphalt everywhere, sidewalk slabs inside blocks, sand + water east
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), asphalt);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, 0); group.add(ground);
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(60, 560), sand);
  beach.rotation.x = -Math.PI / 2; beach.position.set(232, 0.06, 0); group.add(beach);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 560), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(412, 0.02, 0); group.add(water);

  // sidewalk block slabs between roads
  for (let i = 0; i < CFG.roadLines.length - 1; i++) {
    for (let j = 0; j < CFG.roadLines.length - 1; j++) {
      const x0 = CFG.roadLines[i] + CFG.roadHalf, x1 = CFG.roadLines[i + 1] - CFG.roadHalf;
      const z0 = CFG.roadLines[j] + CFG.roadHalf, z1 = CFG.roadLines[j + 1] - CFG.roadHalf;
      const slab = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), walk);
      slab.rotation.x = -Math.PI / 2;
      slab.position.set((x0 + x1) / 2, 0.05, (z0 + z1) / 2);
      group.add(slab);
    }
  }

  // centre dashes along every road
  const dashGeo = new THREE.BoxGeometry(0.5, 0.06, 4);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xccbb55 });
  const dashes = [];
  for (const l of CFG.roadLines) {
    for (let v = -240; v <= 240; v += 16) {
      dashes.push([l, v, 0]); dashes.push([v, l, 1]);
    }
  }
  const dashMesh = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
  const m4 = new THREE.Matrix4();
  dashes.forEach(([x, z, rot], i) => {
    m4.makeRotationY(rot ? Math.PI / 2 : 0);
    m4.setPosition(x, 0.08, z);
    dashMesh.setMatrixAt(i, m4);
  });
  group.add(dashMesh);

  // buildings, one or two per block, heights by district
  const blocks = [];
  for (let i = 0; i < CFG.roadLines.length - 1; i++) {
    for (let j = 0; j < CFG.roadLines.length - 1; j++) {
      blocks.push({
        x0: CFG.roadLines[i] + CFG.roadHalf + 3, x1: CFG.roadLines[i + 1] - CFG.roadHalf - 3,
        z0: CFG.roadLines[j] + CFG.roadHalf + 3, z1: CFG.roadLines[j + 1] - CFG.roadHalf - 3,
      });
    }
  }
  for (const b of blocks) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const d = DISTRICTS.find(dd => cx >= dd.x0 && cx < dd.x1 && cz >= dd.z0 && cz < dd.z1) || DISTRICTS[2];
    const n = chance(rng, 0.35) ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const w = range(rng, 18, Math.min(42, (b.x1 - b.x0) / n - 4));
      const dep = range(rng, 18, Math.min(42, b.z1 - b.z0 - 4));
      const h = range(rng, d.hMin, d.hMax);
      const bx = n === 1 ? cx : b.x0 + (k + 0.5) * ((b.x1 - b.x0) / n);
      const bz = cz + range(rng, -6, 6);
      box(w, h, dep, mats[d.name], bx, h / 2, bz, group);
      solids.push({ minX: bx - w / 2, maxX: bx + w / 2, minZ: bz - dep / 2, maxZ: bz + dep / 2 });
      // rooftop beacon on tall towers
      if (h > 55) box(1.5, 1.5, 1.5, new THREE.MeshBasicMaterial({ color: 0xff3344 }), bx, h + 1, bz, group);
    }
  }

  // neon signs: one giant sign per district, on a pole at its corner
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  for (const d of DISTRICTS) {
    const tex = signTexture(d.name.toUpperCase(), '#' + d.neon.toString(16).padStart(6, '0'));
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 8.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
    );
    const sx = (d.x0 + d.x1) / 2, sz = d.z0 + 12;
    box(1.2, 26, 1.2, poleMat, sx - 16, 13, sz, group);
    box(1.2, 26, 1.2, poleMat, sx + 16, 13, sz, group);
    sign.position.set(sx, 26, sz);
    group.add(sign);
    // a second face so the sign reads from both sides of the street
    const back = sign.clone();
    back.position.z = sz - 0.15;
    back.rotation.y = Math.PI;
    group.add(back);
  }

  // The Loft club sign, over the Comet GT's street
  const loftSign = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 6.5),
    new THREE.MeshBasicMaterial({ map: signTexture('THE LOFT', '#ff2e88'), transparent: true, side: THREE.DoubleSide })
  );
  loftSign.position.set(PLACES.loft.x, 14, PLACES.loft.z - 24);
  group.add(loftSign);
  const loftBack = loftSign.clone();
  loftBack.position.z = PLACES.loft.z - 24.15;
  loftBack.rotation.y = Math.PI;
  group.add(loftBack);

  // palms along Ocean Drive and the beach
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4126 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x1d6b34, emissive: 0x0a2e14, emissiveIntensity: 0.6 });
  const palms = [];
  for (let z = -220; z <= 220; z += 28) {
    palms.push([212, z + range(rng, -4, 4)]);
    if (chance(rng, 0.5)) palms.push([236, z + range(rng, -4, 4)]);
  }
  for (const [x, z] of palms) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 9, 6), trunkMat);
    trunk.position.set(x, 4.5, z); group.add(trunk);
    for (let f = 0; f < 5; f++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.4, 4), leafMat);
      const a = (f / 5) * Math.PI * 2;
      frond.position.set(x + Math.cos(a) * 1.3, 9.2, z + Math.sin(a) * 1.3);
      frond.rotation.z = Math.cos(a) * 1.1;
      frond.rotation.x = -Math.sin(a) * 1.1;
      group.add(frond);
    }
  }

  // street lamps at intersections
  const lampHead = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const x of CFG.roadLines) {
    for (const z of CFG.roadLines) {
      box(0.4, 7, 0.4, poleMat, x + 8, 3.5, z + 8, group);
      box(1.6, 0.5, 0.5, lampHead, x + 8, 7.1, z + 8, group);
    }
  }

  // pier: a low wooden deck east into the bay, with a ferris wheel at the end
  const deck = box(96, 0.24, 14, wood, 272, 0.12, CFG.pierZ, group);
  const wheel = new THREE.Group();
  wheel.position.set(CFG.pierEndX - 4, 16, CFG.pierZ);
  wheel.rotation.y = Math.PI / 2; // face the pier so the circle reads from the deck
  const rim = new THREE.Mesh(new THREE.TorusGeometry(13, 0.7, 6, 24),
    new THREE.MeshBasicMaterial({ color: 0xff2e88 }));
  wheel.add(rim);
  for (let s = 0; s < 6; s++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.5, 26, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xcccccc }));
    spoke.rotation.z = (s / 6) * Math.PI;
    wheel.add(spoke);
  }
  for (let s = 0; s < 8; s++) {
    const a = (s / 8) * Math.PI * 2;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 2.4),
      new THREE.MeshLambertMaterial({ color: pick(rng, [0xff2e88, 0x35e0ff, 0xffc233, 0x2effc8]) }));
    cab.position.set(Math.cos(a) * 13, Math.sin(a) * 13, 0);
    wheel.add(cab);
  }
  group.add(wheel);
  box(3, 16, 3, poleMat, CFG.pierEndX - 4, 8, CFG.pierZ - 2, group);
  solids.push({ minX: CFG.pierEndX - 6, maxX: CFG.pierEndX - 2, minZ: CFG.pierZ - 4, maxZ: CFG.pierZ });

  // foundry crane
  const crane = new THREE.Group();
  crane.position.set(-176, 0, 176);
  box(4, 34, 4, new THREE.MeshLambertMaterial({ color: 0xc9a227 }), 0, 17, 0, crane);
  const jib = box(30, 2, 2, new THREE.MeshLambertMaterial({ color: 0xc9a227 }), 12, 32, 0, crane);
  jib.rotation.z = 0.12;
  box(6, 6, 6, new THREE.MeshLambertMaterial({ color: 0x8a6d1f }), -4, 30, 0, crane);
  group.add(crane);
  solids.push({ minX: -179, maxX: -173, minZ: 173, maxZ: 179 });

  // Bay Coins: spinning gold rings at three spots
  const coins = [];
  const coinSpots = [PLACES.oceanCoin, PLACES.plazaCoin, PLACES.dockCoin];
  for (const s of coinSpots) {
    const coin = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.45, 8, 20), gold);
    coin.position.set(s.x, 2.2, s.z);
    coin.rotation.y = Math.PI / 2;
    group.add(coin);
    coins.push({ x: s.x, z: s.z, mesh: coin, taken: false });
  }

  return { group, solids, coins, wheel };
}
