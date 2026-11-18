// The HUD: open-world crime vocabulary — wanted stars + big cash top-right,
// circular minimap bottom-left with health/armour/special bars under it, a
// numbered mission card, a police-response panel, a named-fixer dialogue
// card, and a full city map (Tab) with named districts and real completion
// stats. DOM clusters, not stat cards: survival and the objective first,
// feedback second, flavour last (game-ui-designer).
import { CITY, MISSIONS } from './config.js';

const $ = (id) => document.getElementById(id);

const REP_TITLES = ['ROOKIE', 'KNOWN DRIVER', 'WHEELMAN', 'BAY LEGEND', 'GHOST OF THE BAY'];
export function repInfo(save) {
  const level = Math.min(5, 1 + save.stats.missionsDone + Math.floor(save.stats.copsLost / 3));
  return { level, title: REP_TITLES[level - 1] };
}

const DIALOGUE = [
  'One last job, Dante. The Comet GT. Tonight.',
  'Drive it to the Marina pier. Easy money.',
  'Lose them first, then deliver.',
  'Bring her in. The buyer is waiting.',
  'Clean work, Dante.',
];

// Mara Voss, the fixer, as a small flat portrait: dark bob, gold hoop.
function drawPortrait(canvas) {
  const c = canvas.getContext('2d');
  c.fillStyle = '#1d3557';
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#264653'; // jacket shoulders
  c.beginPath();
  c.moveTo(8, 64);
  c.quadraticCurveTo(32, 40, 56, 64);
  c.closePath();
  c.fill();
  c.fillStyle = '#1a1210'; // dark bob hair
  c.beginPath();
  c.arc(32, 28, 17, 0, Math.PI * 2);
  c.fill();
  c.fillRect(15, 24, 8, 22);
  c.fillRect(41, 24, 8, 22);
  c.fillStyle = '#d4b896'; // face
  c.beginPath();
  c.arc(32, 30, 12, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1a1210'; // fringe + eyes
  c.beginPath();
  c.arc(32, 24, 12, Math.PI, 0);
  c.fill();
  c.fillRect(24, 29, 3, 2);
  c.fillRect(37, 29, 3, 2);
  c.strokeStyle = '#f4a900'; // gold hoop earring
  c.lineWidth = 2;
  c.beginPath();
  c.arc(44, 38, 4, 0, Math.PI * 2);
  c.stroke();
}

export function createHud() {
  const minimap = $('minimap');
  const mapCtx = minimap.getContext('2d');
  const bigmap = $('bigmap');
  const bigCtx = bigmap ? bigmap.getContext('2d') : null;
  const starsEl = $('stars');
  const cashEl = $('cash');
  const objectiveEl = $('objective');
  const feedEl = $('feed');
  const speedEl = $('speed');
  const healthEl = $('health-fill');
  const promptEl = $('prompt');
  const promptFill = $('prompt-fill');
  const bannerEl = $('banner');
  const fpsEl = $('fps');
  const missionTitleEl = $('mission-title');
  const missionStageEl = $('mission-stage');
  const missionNextEl = $('mission-next');
  const unitsEl = $('units');
  const dialogueEl = $('dialogue');
  const dialogueLineEl = $('dialogue-line');
  const districtEl = $('district');
  const barHealthEl = $('bar-health');
  const barArmorEl = $('bar-armor');
  const barSpecialEl = $('bar-special');
  drawPortrait($('portrait'));
  let feedShown = 0;
  let bannerTimer = 0;
  let lastObjective = '';

  // Five stars; lit ones glow, and while the heat is fading they blink dim.
  function starString(stars, blinking, time) {
    let out = '';
    for (let i = 0; i < 5; i += 1) {
      const filled = i < stars;
      const dim = blinking && Math.floor(time * 2) % 2 === 0;
      out += `<span class="star${filled ? ' on' : ''}${dim ? ' dim' : ''}">★</span>`;
    }
    return out;
  }

  // Static ground of a map: dark base, sea, blocks, roads, district names.
  function paintGround(ctx, size, S, ox, oy, labels, mx, mz) {
    ctx.fillStyle = '#141a30';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#14324a'; // sea
    ctx.fillRect(0, mz(106), size, size - mz(106));
    ctx.fillStyle = '#3a3230'; // blocks
    for (const bx of CITY.blocks) {
      for (const bz of CITY.blocks) {
        ctx.fillRect(mx(bx - 15), mz(bz - 15), 30 * S, 30 * S);
      }
    }
    ctx.strokeStyle = '#8a7a5a';
    ctx.lineWidth = Math.max(2, 4 * S);
    for (const road of CITY.roads) {
      ctx.beginPath();
      ctx.moveTo(mx(road), 0);
      ctx.lineTo(mx(road), size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, mz(road));
      ctx.lineTo(size, mz(road));
      ctx.stroke();
    }
    if (labels) {
      ctx.fillStyle = '#f5ead6';
      ctx.font = `bold ${Math.round(13 * S)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      for (const [name, x, z] of [['DOWNTOWN', 0, 0], ['HILLS', 0, -80], ['PORT', -80, 0], ['MARINA', 80, 80], ['OCEAN DRIVE', 0, 112]]) {
        ctx.fillText(name, mx(x), mz(z));
      }
    }
  }

  // Live layer of a map: waypoint diamond, coins, traffic, police cones and
  // dots, the escape search circle, and Dante's arrow (grey while hidden).
  function paintLive(ctx, world, S, mx, mz) {
    const wp = world.missions.waypoint;
    if (wp) {
      const pulse = (6 + Math.sin(world.elapsed * 4) * 2) * S;
      ctx.fillStyle = '#f4a900';
      ctx.beginPath();
      ctx.moveTo(mx(wp.x), mz(wp.z) - pulse);
      ctx.lineTo(mx(wp.x) + pulse, mz(wp.z));
      ctx.lineTo(mx(wp.x), mz(wp.z) + pulse);
      ctx.lineTo(mx(wp.x) - pulse, mz(wp.z));
      ctx.fill();
    }
    ctx.fillStyle = '#f4a900'; // Bay Coins
    for (const coin of world.city.coins) {
      if (!coin.taken) {
        ctx.beginPath();
        ctx.arc(mx(coin.x), mz(coin.z), Math.max(2, 2.5 * S), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#9a8a72'; // traffic
    for (const car of world.traffic) {
      ctx.fillRect(mx(car.x) - 1.5, mz(car.z) - 1.5, 3, 3);
    }
    // Police vision cones: where the SBPD can see you.
    for (const car of world.police.cars) {
      const a = Math.atan2(Math.cos(car.heading), Math.sin(car.heading));
      ctx.fillStyle = 'rgba(255,60,60,0.20)';
      ctx.beginPath();
      ctx.moveTo(mx(car.x), mz(car.z));
      ctx.arc(mx(car.x), mz(car.z), 26 * S, a - 0.4, a + 0.4);
      ctx.closePath();
      ctx.fill();
    }
    const flash = Math.floor(world.elapsed * 3) % 2 === 0;
    for (const car of world.police.cars) {
      ctx.fillStyle = flash ? '#ff4444' : '#4488ff';
      ctx.beginPath();
      ctx.arc(mx(car.x), mz(car.z), Math.max(3, 4 * S), 0, Math.PI * 2);
      ctx.fill();
    }
    const player = world.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    const heading = player.inCar ? player.inCar.heading : player.heading;
    // Search area while escaping: leave the red circle and the stars drop.
    if (world.wanted.stars > 0 && world.wanted.blinking) {
      ctx.strokeStyle = `rgba(255,60,60,${0.5 + Math.sin(world.elapsed * 4) * 0.3})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(mx(px), mz(pz), 55 * S, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = world.wanted.blinking ? '#9a8a72' : '#f4a900'; // grey arrow = hidden
    ctx.save();
    ctx.translate(mx(px), mz(pz));
    ctx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)));
    ctx.beginPath();
    ctx.moveTo(0, -7 * S);
    ctx.lineTo(5 * S, 6 * S);
    ctx.lineTo(-5 * S, 6 * S);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // One map painter for both the round minimap and the big Tab map.
  function drawMap(ctx, world, size, S, ox, oy, labels) {
    const mx = (x) => (x + 100) * S + ox;
    const mz = (z) => (z + 100) * S + oy;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    if (size <= 220) {
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 96, 0, Math.PI * 2);
      ctx.clip();
    }
    paintGround(ctx, size, S, ox, oy, labels, mx, mz);
    paintLive(ctx, world, S, mx, mz);
    ctx.restore();
    if (size <= 220) {
      ctx.strokeStyle = '#f4a900';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 96, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMinimap(world) {
    drawMap(mapCtx, world, 200, 0.72, 18, 8, false);
  }

  // Objective line + banner, shown once per objective change.
  function refreshObjective(world, dt) {
    if (world.missions.objective !== lastObjective) {
      objectiveEl.textContent = world.missions.objective;
      lastObjective = world.missions.objective;
      // Staged shots frame the action, not the notification.
      if (!world.shotCam && !world.noBanner) {
        bannerEl.textContent = world.missions.objective;
        bannerEl.classList.add('show');
        bannerTimer = 3.5;
      }
    }
    if (bannerTimer > 0) {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.classList.remove('show');
    }
  }

  // Feed: newest lines on top, at most three kept.
  function refreshFeed(world) {
    while (feedShown < world.feedLog.length) {
      const line = world.feedLog[feedShown];
      feedShown += 1;
      const div = document.createElement('div');
      div.textContent = line;
      feedEl.prepend(div);
      while (feedEl.children.length > 3) feedEl.removeChild(feedEl.lastChild);
    }
  }

  // Mission card: numbered job, step bar, what comes next.
  function refreshMissionCard(world) {
    const m = world.missions;
    const mission = MISSIONS[m.index];
    missionTitleEl.textContent = `MISSION ${m.index + 1}/6 — ${mission.name}`;
    missionStageEl.innerHTML = [0, 1, 2, 3].map((i) =>
      `<span class="seg${i < m.step + 1 ? ' on' : ''}"></span>`).join('') + `<span class="step-label">STEP ${Math.min(m.step + 1, 4)}/4</span>`;
    missionNextEl.textContent = m.index + 1 < MISSIONS.length
      ? `NEXT: MISSION ${m.index + 2} — ${MISSIONS[m.index + 1].name}` : 'NEXT: THE LAST JOB';
  }

  // Police response panel: real units, real distances, real status.
  function refreshPolicePanel(world) {
    const player = world.player;
    if (world.wanted.stars > 0) {
      const px = player.inCar ? player.inCar.x : player.x;
      const pz = player.inCar ? player.inCar.z : player.z;
      const rows = world.police.cars.slice(0, 4).map((car, i) => {
        const d = Math.round(Math.hypot(car.x - px, car.z - pz));
        const status = d <= 30 ? 'RAMMING' : 'CHASING';
        return `<div>UNIT ${i + 1} — ${d}m — ${status}</div>`;
      });
      if (world.police.heli.visible) rows.push('<div>AIR 1 — SPOTLIGHT</div>');
      unitsEl.innerHTML = `<div class="units-head">SBPD RESPONSE — ${world.wanted.stars}★</div>${rows.join('')}`;
      unitsEl.classList.add('show');
    } else {
      unitsEl.classList.remove('show');
    }
  }

  // Dialogue card: Mara Voss, the fixer, by mission step.
  function refreshDialogue(world) {
    const m = world.missions;
    if (m.active) {
      dialogueLineEl.textContent = DIALOGUE[Math.min(m.step, 4)];
      dialogueEl.classList.add('show');
    } else {
      dialogueEl.classList.remove('show');
    }
  }

  // Speed, health, district and the three bars under the minimap.
  function refreshMeters(world) {
    const player = world.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    districtEl.textContent = `${world.districtName(px, pz).toUpperCase()} — SOLMAR BAY`;
    const speed = player.inCar ? Math.abs(player.inCar.speed) * 3.6 : Math.abs(player.speed) * 3.6;
    speedEl.textContent = `${Math.round(speed)}`;
    const health = player.inCar ? player.inCar.health : player.health;
    healthEl.style.width = `${Math.max(0, health)}%`;
    healthEl.style.background = health > 50 ? '#2a9d8f' : health > 25 ? '#f4a900' : '#e76f51';
    // Three status bars under the minimap: health / armour / special (nitro).
    barHealthEl.style.width = `${Math.max(0, player.health)}%`;
    barArmorEl.style.width = `${Math.max(0, player.armor)}%`;
    barSpecialEl.style.width = `${player.inCar ? Math.max(0, player.inCar.nitro) : 0}%`;
  }

  // Context prompt: steal / drive / step out, with a hold progress bar.
  function refreshPrompt(world) {
    const player = world.player;
    if (!player.inCar && player.stealTarget) {
      const car = player.stealTarget;
      const label = car.isTraffic ? `HOLD E TO STEAL — ${car.model.name}` : `HOLD E TO DRIVE — ${car.model.name}`;
      promptEl.querySelector('.prompt-text').textContent = label;
      promptFill.style.width = `${Math.round(player.stealProgress * 100)}%`;
      promptEl.classList.add('show');
    } else if (player.inCar && Math.abs(player.inCar.speed) < 2) {
      promptEl.querySelector('.prompt-text').textContent = 'Press E to step out';
      promptFill.style.width = '0%';
      promptEl.classList.add('show');
    } else {
      promptEl.classList.remove('show');
    }
  }

  return {
    update(world, dt) {
      const player = world.player;
      starsEl.innerHTML = starString(world.wanted.stars, world.wanted.blinking, world.elapsed);
      cashEl.textContent = `$${world.save.cash.toLocaleString('en-US')}`;
      refreshObjective(world, dt);
      refreshFeed(world);
      refreshMissionCard(world);
      refreshPolicePanel(world);
      refreshDialogue(world);
      refreshMeters(world);
      refreshPrompt(world);
      drawMinimap(world);
      if (world.fpsSample !== null) fpsEl.textContent = `${world.fpsSample} FPS`;
    },
    show(id) {
      for (const screen of ['title-screen', 'pause-screen', 'complete-screen', 'busted-screen', 'wasted-screen', 'map-screen']) {
        $(screen).classList.toggle('show', screen === id);
      }
      $('hud').classList.toggle('show', id === null);
    },
    showMap(world) {
      drawMap(bigCtx, world, 520, 1.9, 40, 16, true);
      const rep = repInfo(world.save);
      const rows = [
        `STORY — ${world.save.stats.missionsDone}/6 jobs done`,
        `CASH — $${world.save.cash.toLocaleString('en-US')}`,
        `REP ${rep.level} — ${rep.title}`,
        `COPS LOST — ${world.save.stats.copsLost}`,
        `CARS STOLEN — ${world.save.stats.carsStolen}`,
        `BAY COINS — ${world.save.stats.coins}/8`,
        `BEST GRADE — ${world.save.bestGrade || '—'}${world.save.bestTime ? ` in ${world.save.bestTime}s` : ''}`,
      ];
      $('map-stats').innerHTML = rows.map((r) => `<div>${r}</div>`).join('')
        + '<div class="map-missions">' + MISSIONS.map((mis, i) =>
          `<div>${i < world.save.stats.missionsDone ? '✓' : i === world.save.stats.missionsDone ? '▶' : '🔒'} ${i + 1}. ${mis.name} — ${mis.fixer}</div>`).join('') + '</div>';
    },
    setTitle(save) {
      $('spec-line').textContent = '6 MISSIONS · 8 CARS · 5 DISTRICTS · 8 BAY COINS · 5 WANTED LEVELS · 3 DIFFICULTIES';
      const rep = repInfo(save);
      $('best-line').textContent = save.bestGrade
        ? `Best run: grade ${save.bestGrade} in ${save.bestTime}s — $${save.cash.toLocaleString('en-US')} in the pocket. REP ${rep.level} ${rep.title} · Coins ${save.stats.coins}/8.`
        : 'No jobs run yet. The city is waiting.';
      $('btn-continue').style.display = save.stats.missionsDone > 0 ? '' : 'none';
    },
    setComplete(result) {
      $('grade').textContent = result.grade;
      $('grade').className = `grade-big grade-${result.grade}`;
      const mins = Math.floor(result.seconds / 60);
      const secs = Math.round(result.seconds % 60);
      $('complete-stats').innerHTML = [
        `Time — ${mins}:${String(secs).padStart(2, '0')}`,
        `Payout — $${result.payout.toLocaleString('en-US')}`,
        `Cars stolen — ${result.stats.carsStolen}`,
        `Top speed — ${Math.round(result.stats.topSpeed)} km/h`,
        `Garage — ${(result.garage || []).join(', ') || 'empty'}`,
      ].map((line) => `<div>${line}</div>`).join('');
      $('next-mission').textContent = 'NEXT: MISSION 2 — THE GETAWAY (Stage 2)';
    },
    setEnd(kind, lost) {
      $(`${kind}-text`).textContent = kind === 'busted'
        ? `The SBPD took you in. You lost $${lost.toLocaleString('en-US')}.`
        : `You woke up at St. Marina Hospital. You lost $${lost.toLocaleString('en-US')}.`;
    },
  };
}
