// The three.js scene: golden-hour sun, warm haze, a sun disc and drifting
// clouds over Solmar Bay. One renderer, one shadow-casting sun, one chase
// camera that follows Dante on foot and by car — plus the smoke puffs that
// mark a hurt car or a handbrake slide.
import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(0xe8b48a, 140, 460);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 40, 120);

  // Low golden-hour sun from the north-west, long shadows across the streets.
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(-140, 95, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  sun.shadow.normalBias = 0.03;
  sun.shadow.intensity = 0.7; // shadows shade, they never go pitch black
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xffe3b3, 0x7a5a40, 0.95);
  scene.add(hemi);

  // Sun disc: a soft radial sprite hanging low in the sky.
  const discCanvas = document.createElement('canvas');
  discCanvas.width = discCanvas.height = 128;
  const dctx = discCanvas.getContext('2d');
  const grad = dctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,240,200,1)');
  grad.addColorStop(0.35, 'rgba(255,200,110,0.85)');
  grad.addColorStop(1, 'rgba(255,180,90,0)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 128, 128);
  const discTex = new THREE.CanvasTexture(discCanvas);
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, transparent: true, depthWrite: false, fog: false }));
  disc.scale.set(180, 180, 1);
  disc.position.set(-320, 130, -260);
  scene.add(disc);

  // A few flat clouds drifting over the bay.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xfff2dd, transparent: true, opacity: 0.75, fog: false });
  const clouds = [];
  for (let i = 0; i < 7; i += 1) {
    const cloud = new THREE.Mesh(new THREE.PlaneGeometry(60 + i * 8, 12), cloudMat);
    cloud.position.set(-200 + i * 65, 95 + (i % 3) * 12, -180 + (i % 2) * 90);
    scene.add(cloud);
    clouds.push(cloud);
  }

  // Smoke puffs: one pool, reused for hurt cars and handbrake slides.
  const puffGeo = new THREE.PlaneGeometry(2.2, 2.2);
  const puffMat = new THREE.MeshBasicMaterial({ color: 0x777777, transparent: true, opacity: 0.5, depthWrite: false });
  const puffs = [];
  for (let i = 0; i < 24; i += 1) {
    const puff = new THREE.Mesh(puffGeo, puffMat.clone());
    puff.visible = false;
    scene.add(puff);
    puffs.push({ mesh: puff, life: 0 });
  }
  let puffIndex = 0;
  function spawnPuff(x, y, z) {
    const puff = puffs[puffIndex];
    puffIndex = (puffIndex + 1) % puffs.length;
    puff.mesh.position.set(x, y, z);
    puff.mesh.visible = true;
    puff.life = 1;
  }

  const camPos = new THREE.Vector3(0, 40, 120);
  const camTarget = new THREE.Vector3(0, 0, 0);

  function updateCamera(world, dt) {
    const player = world.player;
    const mode = world.cameraMode;
    if (world.shotCam) {
      // A staged shot frames its own composition (see shots.js).
      camPos.set(world.shotCam.x, world.shotCam.y, world.shotCam.z);
      camTarget.set(world.shotCam.lx, world.shotCam.ly, world.shotCam.lz);
    } else if (mode === 'title') {
      const t = world.elapsed * 0.05;
      camPos.set(Math.cos(t) * 130, 55, Math.sin(t) * 130);
      camTarget.set(0, 5, 0);
    } else if (player.inCar) {
      const car = player.inCar;
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      const want = new THREE.Vector3(car.x - fx * 11, 4.6, car.z - fz * 11);
      const look = new THREE.Vector3(car.x + fx * 8, 1.5, car.z + fz * 8);
      camPos.lerp(want, Math.min(1, dt * 5));
      camTarget.lerp(look, Math.min(1, dt * 7));
    } else {
      const fx = Math.sin(player.camYaw);
      const fz = Math.cos(player.camYaw);
      const want = new THREE.Vector3(player.x - fx * 6.5, 3.1, player.z - fz * 6.5);
      const look = new THREE.Vector3(player.x + fx * 5, 1.4, player.z + fz * 5);
      camPos.lerp(want, Math.min(1, dt * 6));
      camTarget.lerp(look, Math.min(1, dt * 8));
    }
    if (world.shake > 0) {
      const s = world.shake * 0.5;
      camPos.x += (Math.random() - 0.5) * s;
      camPos.y += (Math.random() - 0.5) * s;
      world.shake = Math.max(0, world.shake - dt * 1.5);
    }
    camera.position.copy(camPos);
    camera.lookAt(camTarget);
  }

  function updateEffects(world, dt) {
    for (const car of world.cars) {
      if (car.health < 40 && !car.wrecked && Math.random() < dt * 8) {
        spawnPuff(car.x + (Math.random() - 0.5), 1.2, car.z + (Math.random() - 0.5));
      }
      if (car.isPlayer && world.handbrakeSmoke && Math.random() < dt * 20) {
        spawnPuff(car.x - Math.sin(car.heading) * 1.5, 0.4, car.z - Math.cos(car.heading) * 1.5);
      }
    }
    for (const puff of puffs) {
      if (!puff.mesh.visible) continue;
      puff.life -= dt * 1.4;
      puff.mesh.position.y += dt * 1.5;
      puff.mesh.material.opacity = Math.max(0, puff.life * 0.45);
      puff.mesh.lookAt(camera.position);
      if (puff.life <= 0) puff.mesh.visible = false;
    }
    for (const cloud of clouds) {
      cloud.position.x += dt * 0.7;
      if (cloud.position.x > 260) cloud.position.x = -260;
    }
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return {
    scene, camera, renderer,
    updateCamera, updateEffects, onResize,
    render() { renderer.render(scene, camera); },
    diagnostics() {
      return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    },
  };
}
