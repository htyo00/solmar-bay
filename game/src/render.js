// The three.js scene: NEON-NOIR NIGHT over Solmar Bay — a cold moon, warm
// lit windows, neon signs and wet streets that reflect them. One renderer,
// one shadow-casting moonlight, one chase camera that follows Dante on foot
// and by car — plus the smoke puffs that mark a hurt car or a handbrake slide.
import * as THREE from 'three';

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft, filmic edges
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x232a4a, 120, 420);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
  camera.position.set(0, 40, 120);

  // Cold moonlight from the north-west, long shadows across the streets.
  const sun = new THREE.DirectionalLight(0x9db8ff, 1.35);
  sun.position.set(-140, 120, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 500;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 4; // PCFSoft blurs the shadow edge
  sun.shadow.intensity = 0.7; // shadows shade, they never go pitch black
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0x4a5a8a, 0x2a2030, 0.75);
  scene.add(hemi);

  // Sky dome: deep indigo overhead fading to a magenta neon glow at the
  // horizon, so the night reads as city air instead of a flat colour.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 256;
  const sctx = skyCanvas.getContext('2d');
  const skyGrad = sctx.createLinearGradient(0, 0, 0, 256);
  skyGrad.addColorStop(0, '#0b1030');
  skyGrad.addColorStop(0.55, '#1c2450');
  skyGrad.addColorStop(0.8, '#432a68');
  skyGrad.addColorStop(0.9, '#a04a7a');
  skyGrad.addColorStop(1, '#d65a8a'); // neon-dusk horizon: pink, not plain orange
  sctx.fillStyle = skyGrad;
  sctx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(700, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  // Reflections: a tiny procedural night sky baked into a PMREM env map, so
  // car paint, glass and wet asphalt reflect neon instead of looking plastic.
  {
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(
      new THREE.SphereGeometry(50, 16, 12),
      new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide }),
    ));
    const envMoon = new THREE.Mesh(
      new THREE.SphereGeometry(4, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8f0ff }),
    );
    envMoon.position.set(-30, 22, -20);
    envScene.add(envMoon);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, 0.04).texture;
    pmrem.dispose();
  }

  // Moon disc: a pale radial sprite hanging high in the sky.
  const discCanvas = document.createElement('canvas');
  discCanvas.width = discCanvas.height = 128;
  const dctx = discCanvas.getContext('2d');
  const grad = dctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(240,246,255,1)');
  grad.addColorStop(0.4, 'rgba(200,215,255,0.7)');
  grad.addColorStop(1, 'rgba(160,180,255,0)');
  dctx.fillStyle = grad;
  dctx.fillRect(0, 0, 128, 128);
  const discTex = new THREE.CanvasTexture(discCanvas);
  const disc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, transparent: true, depthWrite: false, fog: false }));
  disc.scale.set(120, 120, 1);
  disc.position.set(-320, 190, -260);
  scene.add(disc);
  // A wide, faint halo around the disc: the haze glow a camera sees.
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex, transparent: true, opacity: 0.22, depthWrite: false, fog: false }));
  halo.scale.set(220, 220, 1);
  halo.position.copy(disc.position);
  scene.add(halo);

  // A few flat clouds drifting over the bay, dark against the glow.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0x8a7a9a, transparent: true, opacity: 0.5, fog: false });
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
