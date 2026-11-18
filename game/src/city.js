// Solmar Bay layout: a road grid, five districts, landmarks, routing helpers.
// The grid is strict on purpose: traffic, police and the mission drive all
// follow roads, so a route is always an L of two straight road runs.
import { CFG } from './config.js';

export const DISTRICTS = [
  { name: 'Old Town', x0: -252, z0: -252, x1: -100, z1: -100, hMin: 10, hMax: 22, tint: 0x8a6f5c, neon: 0xff9a3c },
  { name: 'Neon Row', x0: 100, z0: -252, x1: 252, z1: -100, hMin: 34, hMax: 88, tint: 0x3a4a6b, neon: 0xff2e88 },
  { name: 'Solmar Plaza', x0: -100, z0: -100, x1: 100, z1: 100, hMin: 26, hMax: 70, tint: 0x4a5a7a, neon: 0x35e0ff },
  { name: 'Foundry Docks', x0: -252, z0: 100, x1: -100, z1: 252, hMin: 11, hMax: 24, tint: 0x5c5a52, neon: 0xffc233 },
  { name: 'Palm Shore', x0: 100, z0: 100, x1: 252, z1: 252, hMin: 16, hMax: 34, tint: 0xc9a06a, neon: 0x2effc8 },
];

export const LANDMARKS = [
  { name: 'The Loft', x: 152, z: -152, kind: 'club' },
  { name: 'Solmar Tower', x: 0, z: -52, kind: 'tower' },
  { name: 'Pier Wheel', x: 318, z: 100, kind: 'wheel' },
  { name: 'Foundry Crane', x: -176, z: 176, kind: 'crane' },
  { name: 'Palm Court Hotel', x: 152, z: 152, kind: 'hotel' },
];

// Key places the missions and systems need.
export const PLACES = {
  loft: { x: 152, z: -152 },
  cometSpawn: { x: 200, z: -150, heading: Math.PI }, // parked on Ocean Drive, nose south
  playerStart: { x: 186, z: -118, heading: Math.PI * 0.5 },
  pierDrop: { x: 312, z: 100 },
  oceanCoin: { x: 200, z: 0 },
  plazaCoin: { x: -52, z: 52 },
  dockCoin: { x: -148, z: 148 },
  policeHq: { x: -152, z: -152 },
  hospital: { x: 148, z: -52 },
};

export function districtAt(x, z) {
  for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  return DISTRICTS[2];
}

export function nearestLine(v) {
  let best = CFG.roadLines[0], bd = 1e9;
  for (const l of CFG.roadLines) { const d = Math.abs(v - l); if (d < bd) { bd = d; best = l; } }
  return best;
}

// L-shaped road route from (ax,az) to (bx,bz): along one road, then the other.
// Returns waypoints [{x,z}, ...] the last of which is the target.
export function roadRoute(ax, az, bx, bz) {
  const pts = [];
  const midX = nearestLine(ax);
  const midZ = nearestLine(bz);
  // drive along the avenue nearest the start, then the street nearest the goal
  if (Math.abs(ax - midX) > 0.01) pts.push({ x: midX, z: az });
  pts.push({ x: midX, z: midZ });
  if (Math.abs(bz - midZ) > 0.01) pts.push({ x: bx, z: midZ });
  pts.push({ x: bx, z: bz });
  return pts;
}

// 2D segment vs AABB test, for line-of-sight between two points.
function segHitsBox(ax, az, bx, bz, b) {
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  const slabs = [
    [b.minX - ax, b.maxX - ax, dx],
    [b.minZ - az, b.maxZ - az, dz],
  ];
  for (const [lo, hi, d] of slabs) {
    if (Math.abs(d) < 1e-9) { if (lo > 0 || hi < 0) return false; continue; }
    let ta = lo / d, tb = hi / d;
    if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return false;
  }
  return true;
}

// True when nothing solid stands between a and b (both {x,z}).
export function hasSight(ax, az, bx, bz, solids) {
  for (const b of solids) {
    if (segHitsBox(ax, az, bx, bz, b)) return false;
  }
  return true;
}

// Push a circle (x,z,r) out of every solid AABB it overlaps. Returns true if moved.
export function pushOut(p, r, solids) {
  let hit = false;
  for (const b of solids) {
    const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.z = cz + (dz / d) * r;
      } else {
        // centre inside the box: shove out along the smallest penetration axis
        const pl = p.x - b.minX, pr = b.maxX - p.x;
        const pt = p.z - b.minZ, pb = b.maxZ - p.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) p.x = b.minX - r;
        else if (m === pr) p.x = b.maxX + r;
        else if (m === pt) p.z = b.minZ - r;
        else p.z = b.maxZ + r;
      }
    }
  }
  return hit;
}
