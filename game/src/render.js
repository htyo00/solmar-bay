// Renderer, night lighting, and the third-person chase camera.
import * as THREE from 'three';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0b1e);
  scene.fog = new THREE.FogExp2(0x0b0b1e, 0.0028);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 900);

  const hemi = new THREE.HemisphereLight(0x4a5a9a, 0x0c0a14, 1.15);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9ab4ff, 1.1);
  moon.position.set(-120, 180, -60);
  scene.add(moon);
  const dusk = new THREE.DirectionalLight(0xff7a4a, 0.35);
  dusk.position.set(200, 40, 120);
  scene.add(dusk);

  // headlights: one spotlight, re-aimed at whatever the player drives
  const beam = new THREE.SpotLight(0xfff2c0, 60, 55, 0.5, 0.45, 1.2);
  beam.position.set(0, 3, 0);
  scene.add(beam);
  scene.add(beam.target);

  function resize(w, h) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const camPos = new THREE.Vector3(0, 26, -40);
  const camLook = new THREE.Vector3(0, 0, 0);
  function updateCamera(G, dt) {
    const p = G.player.pos;
    const heading = G.player.inCar ? G.player.car.heading : G.player.heading;
    const speed = G.player.inCar ? Math.abs(G.player.car.speed) : G.player.speed;
    const dist = 13 + speed * 0.22;
    const height = 6.5 + speed * 0.06;
    // camera sits BEHIND the facing (opposite the travel direction) and
    // looks ahead past the player, so the road ahead is always in frame.
    const orbit = G.camOrbit || 0;
    const a = heading + orbit;
    const tx = p.x + Math.sin(a) * dist;
    const tz = p.z + Math.cos(a) * dist;
    const k = 1 - Math.pow(0.0001, dt);
    camPos.x += (tx - camPos.x) * k;
    camPos.y += (height - camPos.y) * k;
    camPos.z += (tz - camPos.z) * k;
    camera.position.copy(camPos);
    camLook.set(
      p.x - Math.sin(heading) * 6,
      2.2,
      p.z - Math.cos(heading) * 6
    );
    camera.lookAt(camLook);
    // headlights follow the car
    if (G.player.inCar) {
      const c = G.player.car;
      beam.position.set(c.pos.x, 3, c.pos.z);
      beam.target.position.set(
        c.pos.x - Math.sin(c.heading) * 20,
        0.5,
        c.pos.z - Math.cos(c.heading) * 20
      );
      beam.intensity = 60;
    } else {
      beam.intensity = 0;
    }
  }

  return { renderer, scene, camera, resize, updateCamera };
}
