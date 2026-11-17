// SOLMAR BAY — the city itself: a 5x5 block grid, four named districts, a
// beachfront boulevard and a marina pier. This module is pure data plus the
// meshes built from it; the road graph drives traffic, police and the minimap.
// District palettes are Golden Hour / Sunset Boulevard (theme-factory).
import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { pick, range } from './random.js';

const DISTRICTS = {
  downtown: { name: 'Downtown', base: '#d4b896', accent: '#f4a900', minH: 25, maxH: 58, per: 1 },
  marina: { name: 'Marina', base: '#f5ead6', accent: '#2a9d8f', minH: 6, maxH: 12, per: 2 },
  hills: { name: 'Hills', base: '#c1666b', accent: '#e9c46a', minH: 10, maxH: 20, per: 2 },
  port: { name: 'Port', base: '#8a7a63', accent: '#e76f51', minH: 8, maxH: 13, per: 1 },
  beach: { name: 'Ocean Drive', base: '#e9c46a', accent: '#f4a261', minH: 10, maxH: 16, per: 2 },
};

export function districtAt(bx, bz) {
  if (bz >= 40 && bx >= 40) return 'marina';
  if (bz >= 80) return 'beach';
  if (Math.abs(bx) <= 40 && Math.abs(bz) <= 40) return 'downtown';
  if (bz <= -40) return 'hills';
  if (bx <= -40) return 'port';
  return 'downtown';
}

/** A facade texture drawn once per district: warm walls, lit windows. */
function facadeTexture(random, base, accent) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 6; col += 1) {
      const lit = random() < 0.45;
      ctx.fillStyle = lit ? accent : 'rgba(40,30,25,0.55)';
      ctx.fillRect(8 + col * 20, 10 + row * 20, 12, 12);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roadTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PALETTE.asphalt;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#f4a900';
  ctx.fillRect(62, 8, 4, 44);
  ctx.fillRect(62, 76, 4, 44);
  ctx.fillStyle = 'rgba(245,234,214,0.8)';
  ctx.fillRect(4, 0, 3, 128);
  ctx.fillRect(121, 0, 3, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

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

export function createCity(random) {
  const buildings = [];
  const props = []; // { kind: 'palm'|'lamp'|'hydrant'|'container'|'billboard', x, z, ... }
  const roads = CITY.roads;
  const nodes = [];
  for (const x of roads) for (const z of roads) nodes.push({ x, z });

  for (const bx of CITY.blocks) {
    for (const bz of CITY.blocks) {
      const key = districtAt(bx, bz);
      const district = DISTRICTS[key];
      const count = district.per;
      for (let i = 0; i < count; i += 1) {
        const w = range(random, 12, 20);
        const d = range(random, 12, 20);
        const h = range(random, district.minH, district.maxH);
        const ox = count === 1 ? 0 : (i === 0 ? -6 : 6);
        const oz = count === 1 ? 0 : (i === 0 ? -6 : 6);
        const x = bx + ox;
        const z = bz + oz;
        buildings.push({ x, z, w, d, h, district: key, name: district.name });
      }
      // Street props: palms on the beach boulevard, lamps everywhere else.
      if (bz === 80) {
        props.push({ kind: 'palm', x: bx - 10, z: 96 });
        props.push({ kind: 'palm', x: bx + 10, z: 96 });
      } else if (random() < 0.5) {
        props.push({ kind: 'lamp', x: bx + 13, z: bz + 13 });
      }
      if (random() < 0.35) props.push({ kind: 'hydrant', x: bx - 13, z: bz + 10 });
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
    start: { x: -60, z: -60, heading: Math.PI / 2 }, // on foot, facing east
    cometSpot: { x: -58, z: -76, heading: Math.PI / 2 }, // the parked Comet GT
  };
}

/** Circle vs building AABBs: push (x, z) out and report the hit normal. */
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

/** The nearest road coordinate on one axis (roads run both ways). */
export function nearestRoad(value) {
  let best = CITY.roads[0];
  for (const road of CITY.roads) if (Math.abs(road - value) < Math.abs(best - value)) best = road;
  return best;
}

export function onRoad(city, x, z) {
  const half = CITY.street / 2 + 1;
  return CITY.roads.some((r) => Math.abs(x - r) < half) || CITY.roads.some((r) => Math.abs(z - r) < half);
}

/** Greedy next intersection toward a target: the road graph, no pathfinding lib. */
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

export function createCityMeshes(city, random) {
  const group = new THREE.Group();
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const facadeMats = {};
  for (const [key, district] of Object.entries(DISTRICTS)) {
    facadeMats[key] = new THREE.MeshStandardMaterial({
      map: facadeTexture(random, district.base, district.accent), roughness: 0.85, metalness: 0.05,
    });
  }
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a403a, roughness: 0.95 });

  // Ground, sand, sea.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2),
    new THREE.MeshStandardMaterial({ color: 0x9a8a72, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, 34),
    new THREE.MeshStandardMaterial({ color: 0xe9c46a, roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, CITY.beachZ + 17);
  sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2 + 200, 200),
    new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.1 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, CITY.seaZ + 100);
  group.add(sea);

  // Roads: asphalt planes with a dashed centre line, one per road line.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.95 });
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

  // Sidewalk plates + buildings.
  const walkMat = new THREE.MeshStandardMaterial({ color: PALETTE.sidewalk, roughness: 1 });
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
  }

  // Marina pier: wooden planks out over the sea.
  const plankMat = new THREE.MeshStandardMaterial({ color: 0x8a6d3b, roughness: 1 });
  for (let i = 0; i < 10; i += 1) {
    const plank = new THREE.Mesh(boxGeo, plankMat);
    plank.scale.set(6, 0.4, 3);
    plank.position.set(city.pier.x, 0.4, 106 + i * 3);
    plank.castShadow = true;
    group.add(plank);
  }

  // Props: palms, lamps, hydrants, containers, billboards.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.9 });
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
  return group;
}
