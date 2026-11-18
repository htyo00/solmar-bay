// SOLMAR BAY — the city itself: a 5x5 block grid, four named districts, a
// beachfront boulevard and a marina pier. This module is pure data plus the
// meshes built from it; the road graph drives traffic, police and the minimap.
// District palettes are Golden Hour / Sunset Boulevard (theme-factory).
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { pick, range } from './random.js';

// Per-district look: wall colour, accent colour, height band, buildings
// per block. Downtown towers; the Marina stays low and pale.
const DISTRICTS = {
  downtown: { name: 'Downtown', base: '#d4b896', accent: '#f4a900', minH: 25, maxH: 58, per: 1 },
  marina: { name: 'Marina', base: '#f5ead6', accent: '#2a9d8f', minH: 6, maxH: 12, per: 2 },
  hills: { name: 'Hills', base: '#c1666b', accent: '#e9c46a', minH: 10, maxH: 20, per: 2 },
  port: { name: 'Port', base: '#8a7a63', accent: '#e76f51', minH: 8, maxH: 13, per: 1 },
  beach: { name: 'Ocean Drive', base: '#e9c46a', accent: '#f4a261', minH: 10, maxH: 16, per: 2 },
};

// Which district a block belongs to, by grid position. The southern row is
// checked first so the beachfront wins over everything south of it.
export function districtAt(bx, bz) {
  if (bz >= 80) return 'beach'; // the southernmost row is the beachfront first
  if (bz >= 40 && bx >= 40) return 'marina';
  if (Math.abs(bx) <= 40 && Math.abs(bz) <= 40) return 'downtown';
  if (bz <= -40) return 'hills';
  if (bx <= -40) return 'port';
  return 'downtown';
}

// One lit window cell inside a facade: dark frame, warm glow or reflective
// glass, a mullion cross, sometimes a curtain.
function paintWindow(ctx, random, x, y, accent) {
  ctx.fillStyle = 'rgba(40,30,25,0.85)'; // frame
  ctx.fillRect(x - 1, y - 1, 14, 14);
  const lit = random() < 0.65; // night: most windows glow warm
  if (lit) {
    const g = ctx.createLinearGradient(x, y, x, y + 12);
    g.addColorStop(0, '#ffd98a');
    g.addColorStop(1, accent);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = random() < 0.5 ? '#2e4256' : '#23282e'; // reflective glass
    ctx.fillRect(x, y, 12, 12);
    ctx.fillStyle = 'rgba(255,240,200,0.25)'; // sky glint
    ctx.fillRect(x, y, 12, 3);
    return;
  }
  ctx.fillRect(x, y, 12, 12);
  ctx.fillStyle = 'rgba(40,30,25,0.6)'; // mullion cross
  ctx.fillRect(x + 5, y, 2, 12);
  ctx.fillRect(x, y + 5, 12, 2);
  if (random() < 0.3) { // curtain
    ctx.fillStyle = 'rgba(245,234,214,0.55)';
    ctx.fillRect(x + 1, y + 1, 5, 10);
  }
}

// A facade texture drawn once per district: warm walls, framed windows
// with lit and reflective glass, and a storefront band at street level.
function facadeTexture(random, base, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  // Faint vertical grime so the wall is not a flat colour.
  for (let i = 0; i < 10; i += 1) {
    ctx.fillStyle = 'rgba(60,45,35,0.06)';
    ctx.fillRect(random() * 128, 0, 3 + random() * 5, 256);
  }
  for (let row = 0; row < 11; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      paintWindow(ctx, random, 8 + col * 20, 10 + row * 20, accent);
    }
  }
  // Street level: storefront glass under an awning stripe.
  ctx.fillStyle = accent;
  ctx.fillRect(0, 232, 128, 6);
  ctx.fillStyle = '#1d2b36';
  ctx.fillRect(6, 238, 116, 18);
  ctx.fillStyle = 'rgba(255,220,140,0.75)';
  ctx.fillRect(10, 242, 34, 10);
  ctx.fillRect(84, 242, 34, 10);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// One road tile (13 units): asphalt with wear, a dashed centre line.
function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i += 1) { // speckle + wear patches
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  ctx.fillRect(20, 90, 26, 14);
  ctx.fillRect(84, 20, 20, 10);
  ctx.fillStyle = '#f4a900'; // dashed centre line, along the road
  ctx.fillRect(18, 62, 52, 4);
  ctx.fillRect(96, 62, 52, 4);
  ctx.fillStyle = 'rgba(245,234,214,0.75)'; // edge lines
  ctx.fillRect(0, 5, 128, 3);
  ctx.fillRect(0, 120, 128, 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 1);
  return texture;
}

// Zebra crossing for one intersection approach.
function crosswalkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = 'rgba(245,234,214,0.9)';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(6 + i * 21, 6, 11, 52);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Sidewalk plate: expansion joints and speckle, so concrete is not flat.
function sidewalkTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PALETTE.sidewalk;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 200; i += 1) {
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  ctx.strokeStyle = 'rgba(60,50,40,0.5)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    ctx.beginPath(); ctx.moveTo(i * 32, 0); ctx.lineTo(i * 32, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i * 32); ctx.lineTo(128, i * 32); ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Rooftop slab: a dark deck with a pale border and vent boxes drawn in.
function roofTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3a332c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#5a4f42';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 120, 120);
  ctx.fillStyle = '#6b6258';
  for (let i = 0; i < 3; i += 1) ctx.fillRect(16 + random() * 80, 16 + random() * 80, 16, 12);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Glowing neon sign: bright text with a halo, drawn once, unlit in the dark.
function neonTexture(line1, line2, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 128);
  ctx.textAlign = 'center';
  ctx.shadowColor = color;
  ctx.shadowBlur = 22;
  ctx.fillStyle = color;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText(line1, 256, 62);
  ctx.fillText(line1, 256, 62);
  ctx.shadowBlur = 10;
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillStyle = '#f5ead6';
  ctx.fillText(line2, 256, 104);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// A billboard face: coloured background, centred bold lines.
function billboardTexture(lines, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = fg;
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  lines.forEach((line, i) => ctx.fillText(line, 128, 52 + i * 38));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// The buildings of one block, placed on the block grid.
function placeBlockBuildings(random, buildings, bx, bz) {
  const key = districtAt(bx, bz);
  const district = DISTRICTS[key];
  const count = district.per;
  for (let i = 0; i < count; i += 1) {
    const w = range(random, 12, 20);
    const d = range(random, 12, 20);
    const h = range(random, district.minH, district.maxH);
    const ox = count === 1 ? 0 : (i === 0 ? -6 : 6);
    const oz = count === 1 ? 0 : (i === 0 ? -6 : 6);
    buildings.push({ x: bx + ox, z: bz + oz, w, d, h, district: key, name: district.name });
  }
}

// The props of one block: palms on the beach boulevard, lamps elsewhere,
// and the occasional hydrant.
function placeBlockProps(random, props, bx, bz) {
  if (bz === 80) {
    props.push({ kind: 'palm', x: bx - 10, z: 96 });
    props.push({ kind: 'palm', x: bx + 10, z: 96 });
  } else if (random() < 0.5) {
    props.push({ kind: 'lamp', x: bx + 13, z: bz + 13 });
  }
  if (random() < 0.35) props.push({ kind: 'hydrant', x: bx - 13, z: bz + 10 });
}

export function createCity(random) {
  const buildings = [];
  const props = []; // { kind: 'palm'|'lamp'|'hydrant'|'container'|'billboard', x, z, ... }
  const roads = CITY.roads;
  const nodes = [];
  for (const x of roads) for (const z of roads) nodes.push({ x, z });

  for (const bx of CITY.blocks) {
    for (const bz of CITY.blocks) {
      placeBlockBuildings(random, buildings, bx, bz);
      placeBlockProps(random, props, bx, bz);
    }
  }
  // Port containers, marina pier, downtown billboards (original fake ads only).
  for (let i = 0; i < 8; i += 1) {
    props.push({ kind: 'container', x: range(random, -95, -65), z: range(random, -15, 55), color: pick(random, ['#e76f51', '#2a9d8f', '#f4a900', '#264653']) });
  }
  const billboards = [
    { lines: ['SOLMAR SODA', 'Taste the Bay'], bg: '#e76f51', fg: '#f5ead6' },
    { lines: ['BAY FM 88.1', 'All hits, all day'], bg: '#264653', fg: '#f4a900' },
    { lines: ['DEL ANO MOTORS', 'Drive it home'], bg: '#f4a900', fg: '#4a403a' },
  ];
  billboards.forEach((board, i) => props.push({ kind: 'billboard', x: -40 + i * 40, z: -58, ...board }));

  return {
    buildings, props, roads, nodes,
    blocks: CITY.blocks,
    loft: { x: -60, z: -80 }, // the safehouse: Dante's Loft, Hills district
    pier: { x: 80, z: 132 }, // Marina pier end — mission 1 delivery point
    start: { x: -52, z: -70, heading: -Math.PI / 2 }, // on the Loft sidewalk, facing the Comet — off the road, so title-screen traffic cannot run Dante over before play starts
    cometSpot: { x: -58, z: -76, heading: 0 }, // the parked Comet GT, nose to the avenue
    // Bay Coins: 8 collectibles, $25 each, counted in the stats panel.
    coins: [
      { x: -80, z: -60 }, { x: 20, z: 20 }, { x: 100, z: 60 }, { x: -20, z: 100 },
      { x: 60, z: -100 }, { x: -100, z: 20 }, { x: 0, z: -20 }, { x: 80, z: 124 },
    ].map((c) => ({ ...c, taken: false, mesh: null })),
    // Armour crates: +50 armour, one each in the Hills and the Marina.
    armorCrates: [
      { x: -40, z: -80 }, { x: 100, z: 20 },
    ].map((c) => ({ ...c, taken: false, mesh: null })),
  };
}

// Circle vs building AABBs: push (x, z) out and report the hit normal.
export function collideBuildings(city, x, z, radius) {
  let hit = null;
  for (const b of city.buildings) {
    const minX = b.x - b.w / 2 - radius;
    const maxX = b.x + b.w / 2 + radius;
    const minZ = b.z - b.d / 2 - radius;
    const maxZ = b.z + b.d / 2 + radius;
    if (x > minX && x < maxX && z > minZ && z < maxZ) {
      const pushLeft = x - minX;
      const pushRight = maxX - x;
      const pushUp = z - minZ;
      const pushDown = maxZ - z;
      const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
      if (min === pushLeft) { x = minX; hit = { nx: -1, nz: 0 }; }
      else if (min === pushRight) { x = maxX; hit = { nx: 1, nz: 0 }; }
      else if (min === pushUp) { z = minZ; hit = { nx: 0, nz: -1 }; }
      else { z = maxZ; hit = { nx: 0, nz: 1 }; }
    }
  }
  return { x, z, hit };
}

// The nearest road coordinate on one axis (roads run both ways).
export function nearestRoad(value) {
  let best = CITY.roads[0];
  for (const road of CITY.roads) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  return best;
}

export function onRoad(city, x, z) {
  const half = CITY.street / 2 + 1;
  return CITY.roads.some((r) => Math.abs(x - r) < half) || CITY.roads.some((r) => Math.abs(z - r) < half);
}

// Greedy next intersection toward a target: the road graph, no pathfinding lib.
export function nextNodeToward(city, fromX, fromZ, toX, toZ, random) {
  const from = { x: nearestRoad(fromX), z: nearestRoad(fromZ) };
  const options = [];
  for (const dx of [-40, 40]) {
    const nx = from.x + dx;
    if (CITY.roads.includes(nx)) options.push({ x: nx, z: from.z });
  }
  for (const dz of [-40, 40]) {
    const nz = from.z + dz;
    if (CITY.roads.includes(nz)) options.push({ x: from.x, z: nz });
  }
  if (options.length === 0) return { x: from.x, z: from.z };
  options.sort((a, b) => (Math.abs(a.x - toX) + Math.abs(a.z - toZ)) - (Math.abs(b.x - toX) + Math.abs(b.z - toZ)));
  return random() < 0.75 ? options[0] : pick(random, options);
}

// Ground, sand and sea planes under the whole city.
function buildTerrain(group, boxGeo) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshStandardMaterial({ color: 0x5a5044, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, 34),
    new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachZ + 17);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 200, 200),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.15, metalness: 0.3 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY.seaZ + 100);
  group.add(sea);
}

// Roads: asphalt planes with a dashed centre line, one per road line,
// plus a zebra crossing at every intersection.
function buildRoads(group) {
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.4, metalness: 0.15 }); // wet asphalt: reflects neon + moon
  for (const r of CITY.roads) {
    const along = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.street), roadMat);
    along.rotation.x = -Math.PI / 2;
    along.position.set(0, 0.03, r);
    along.receiveShadow = true;
    group.add(along);
    const across = new THREE.Mesh(new THREE.PlaneGeometry(CITY.street, CITY.half * 2), roadMat);
    across.rotation.x = -Math.PI / 2;
    across.rotation.z = Math.PI / 2;
    across.position.set(r, 0.03, 0);
    across.receiveShadow = true;
    group.add(across);
  }
  const crossTex = crosswalkTexture();
  const crossMat = new THREE.MeshStandardMaterial({ map: crossTex, transparent: true, roughness: 0.9 });
  for (const x of CITY.roads) {
    for (const z of CITY.roads) {
      const cross = new THREE.Mesh(new THREE.PlaneGeometry(11, 5.5), crossMat);
      cross.rotation.x = -Math.PI / 2;
      cross.rotation.z = (Math.abs(x + z) % 80 === 0) ? 0 : Math.PI / 2;
      cross.position.set(x, 0.045, z);
      cross.receiveShadow = true;
      group.add(cross);
    }
  }
}

// Sidewalk plates, then every building with its roof — and rooftop clutter
// on the tall towers (AC boxes and an antenna), so the skyline reads as a
// real city from above (title orbit, cover shot).
function buildBlocks(group, city, boxGeo, facadeMats, roofMat, mastMat) {
  const walkMat = new THREE.MeshStandardMaterial({ map: sidewalkTexture(), roughness: 1 });
  for (const bx of CITY.blocks) {
    for (const bz of CITY.blocks) {
      const plate = new THREE.Mesh(boxGeo, walkMat);
      plate.scale.set(30, 0.3, 30);
      plate.position.set(bx, 0.15, bz);
      plate.receiveShadow = true;
      group.add(plate);
    }
  }
  for (const b of city.buildings) {
    const mesh = new THREE.Mesh(boxGeo, facadeMats[b.district]);
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const roof = new THREE.Mesh(boxGeo, roofMat);
    roof.scale.set(b.w + 0.4, 0.3, b.d + 0.4);
    roof.position.set(b.x, b.h + 0.15, b.z);
    group.add(roof);
    if (b.h > 25) {
      const acMat = new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.9 });
      for (const [ox, oz] of [[-3, -2], [3, 2]]) {
        const ac = new THREE.Mesh(boxGeo, acMat);
        ac.scale.set(1.6, 0.9, 1.2);
        ac.position.set(b.x + ox, b.h + 0.75, b.z + oz);
        group.add(ac);
      }
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 5, 6), mastMat);
      mast.position.set(b.x + b.w / 4, b.h + 2.8, b.z - b.d / 4);
      group.add(mast);
    }
  }
}

// Marina pier: wooden planks out over the sea.
function buildPier(group, city, boxGeo) {
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6d3b, roughness: 1 });
  for (let i = 0; i < 10; i += 1) {
    const plank = new THREE.Mesh(boxGeo, plankMat);
    plank.scale.set(6, 0.4, 3);
    plank.position.set(city.pier.x, 0.4, 106 + i * 3);
    plank.castShadow = true;
    group.add(plank);
  }
}

// Props: palms, lamps, hydrants, containers, billboards.
function buildProps(group, city, boxGeo) {
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.9 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x4a403a, roughness: 0.6, metalness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc861, emissiveIntensity: 1.6 });
  for (const prop of city.props) {
    if (prop.kind === 'palm') {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
      trunk.position.set(prop.x, 3.5, prop.z);
      trunk.castShadow = true;
      group.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), leafMat);
      crown.position.set(prop.x, 7.4, prop.z);
      crown.scale.y = 0.55;
      crown.castShadow = true;
      group.add(crown);
    } else if (prop.kind === 'lamp') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 6), lampMat);
      pole.position.set(prop.x, 3, prop.z);
      group.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), bulbMat);
      bulb.position.set(prop.x, 6.1, prop.z);
      group.add(bulb);
    } else if (prop.kind === 'hydrant') {
      const hydrant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0xe76f51, roughness: 0.7 }));
      hydrant.position.set(prop.x, 0.45, prop.z);
      group.add(hydrant);
    } else if (prop.kind === 'container') {
      const box = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color: prop.color, roughness: 0.8 }));
      box.scale.set(6, 2.6, 2.6);
      box.position.set(prop.x, 1.3, prop.z);
      box.castShadow = true;
      group.add(box);
    } else if (prop.kind === 'billboard') {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(14, 7),
        new THREE.MeshStandardMaterial({ map: billboardTexture(prop.lines, prop.bg, prop.fg), roughness: 0.8 }));
      board.position.set(prop.x, 16, prop.z);
      group.add(board);
      const post = new THREE.Mesh(boxGeo, lampMat);
      post.scale.set(0.6, 10, 0.6);
      post.position.set(prop.x, 6, prop.z);
      group.add(post);
    }
  }
  return { trunkMat, lampMat };
}

// Landmarks, one per district: the neon arch over Ocean Drive (the cover
// focal point), a cyan BAY FM sign on a Downtown face, Port cranes, a
// Hills observatory dome, and the mountain ridge framing the horizon.
function buildLandmarks(group, city, boxGeo, lampMat) {
  const neonMat = new THREE.MeshBasicMaterial({ map: neonTexture('SOLMAR BAY', 'OCEAN DRIVE', '#ff4fd8'), transparent: true, side: THREE.DoubleSide });
  for (const side of [-6, 6]) {
    const post = new THREE.Mesh(boxGeo, lampMat);
    post.scale.set(0.5, 9, 0.5);
    post.position.set(0, 4.5, 100 + side);
    group.add(post);
  }
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(16, 4.5), neonMat);
  arch.rotation.y = Math.PI / 2;
  arch.position.set(0, 8.6, 100);
  group.add(arch);
  let bayFm = null;
  for (const b of city.buildings) {
    if (!bayFm || Math.hypot(b.x - 0, b.z - 80) < Math.hypot(bayFm.x - 0, bayFm.z - 80)) bayFm = b;
  }
  if (bayFm) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(14, bayFm.w), 3),
      new THREE.MeshBasicMaterial({ map: neonTexture('BAY FM 88.1', 'ALL HITS, ALL DAY', '#4fd8ff'), transparent: true }));
    sign.position.set(bayFm.x, 11, bayFm.z + bayFm.d / 2 + 0.15);
    group.add(sign);
  }
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xe76f51, roughness: 0.7 });
  for (const [cx, cz] of [[-88, -10], [-88, 30]]) {
    const mast = new THREE.Mesh(boxGeo, craneMat);
    mast.scale.set(1.5, 26, 1.5);
    mast.position.set(cx, 13, cz);
    group.add(mast);
    const arm = new THREE.Mesh(boxGeo, craneMat);
    arm.scale.set(18, 1.2, 1.2);
    arm.position.set(cx + 6, 24, cz);
    group.add(arm);
  }
  let domeBase = null;
  for (const b of city.buildings) {
    if (b.district === 'hills' && (!domeBase || b.h > domeBase.h)) domeBase = b;
  }
  if (domeBase) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(domeBase.w, domeBase.d) * 0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xd4b896, roughness: 0.6 }));
    dome.position.set(domeBase.x, domeBase.h + 0.3, domeBase.z);
    group.add(dome);
  }
  const ridgeMat = new THREE.MeshBasicMaterial({ color: 0x241a3e });
  for (const [mx, mr, mh] of [[-160, 90, 110], [-60, 70, 80], [60, 80, 95], [160, 90, 105]]) {
    const peak = new THREE.Mesh(new THREE.ConeGeometry(mr, mh, 4), ridgeMat);
    peak.position.set(mx, mh / 2 - 4, -215);
    peak.rotation.y = Math.PI / 4;
    group.add(peak);
  }
}

// Beach umbrellas on the sand: colour pops against the night.
function buildUmbrellas(group, trunkMat) {
  const umbrellaColors = [0xff4fd8, 0x4fd8ff, 0xf4a900, 0xe76f51, 0x2a9d8f, 0xc1666b];
  for (let i = 0; i < 6; i += 1) {
    const ux = -80 + i * 32;
    const uz = 118 + (i % 2) * 8;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), trunkMat);
    pole.position.set(ux, 1.2, uz);
    group.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.2, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: umbrellaColors[i], roughness: 0.8 }));
    canopy.position.set(ux, 2.8, uz);
    group.add(canopy);
  }
}

// Pickups: Bay Coins (gold, upright) and armour crates (blue SBPD vests).
function buildPickups(group, city, boxGeo) {
  const coinMat = new THREE.MeshStandardMaterial({ color: 0xf4a900, emissive: 0xa87800, emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.3 });
  for (const coin of city.coins) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16), coinMat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.set(coin.x, 1.1, coin.z);
    group.add(mesh);
    coin.mesh = mesh;
  }
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x2244aa, emissive: 0x112266, emissiveIntensity: 0.6, roughness: 0.6 });
  for (const crate of city.armorCrates) {
    const mesh = new THREE.Mesh(boxGeo, crateMat);
    mesh.scale.set(1.2, 0.9, 1.2);
    mesh.position.set(crate.x, 0.45, crate.z);
    group.add(mesh);
    crate.mesh = mesh;
  }
}

export function createCityMeshes(city, random) {
  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = {};
  for (const [key, district] of Object.entries(DISTRICTS)) {
    facadeMats[key] = new THREE.MeshStandardMaterial({
      map: facadeTexture(random, district.base, district.accent), roughness: 0.85, metalness: 0.05,
    });
  }
  const roofMat = new THREE.MeshStandardMaterial({ map: roofTexture(random), roughness: 0.95 });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x4a403a, roughness: 0.6, metalness: 0.4 });

  buildTerrain(group, boxGeo);
  buildRoads(group);
  buildBlocks(group, city, boxGeo, facadeMats, roofMat, mastMat);
  buildPier(group, city, boxGeo);
  const { trunkMat, lampMat } = buildProps(group, city, boxGeo);
  buildLandmarks(group, city, boxGeo, lampMat);
  buildUmbrellas(group, trunkMat);
  buildPickups(group, city, boxGeo);
  return group;
}
