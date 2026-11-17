// The HUD: wanted stars, cash, mission objective, dispatch feed, speed and
// health, a live minimap with blips — plus the title, pause, mission-complete,
// busted and wasted screens. DOM clusters, not stat cards: survival and the
// objective first, feedback second, flavour last (game-ui-designer).
import { CITY, PALETTE } from './config.js';

const $ = (id) => document.getElementById(id);

export function createHud() {
  const minimap = $('minimap');
  const mapCtx = minimap.getContext('2d');
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
  let feedShown = 0;
  let bannerTimer = 0;
  let lastObjective = '';

  function starString(stars, blinking, time) {
    let out = '';
    for (let i = 0; i < 5; i += 1) {
      const filled = i < stars;
      const dim = blinking && Math.floor(time * 2) % 2 === 0;
      out += `<span class="star${filled ? ' on' : ''}${dim ? ' dim' : ''}">★</span>`;
    }
    return out;
  }

  function drawMinimap(world) {
    const size = 200;
    const S = 0.72;
    const mx = (x) => (x + 100) * S + 18;
    const mz = (z) => (z + 100) * S + 8;
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(size / 2, size / 2, 96, 0, Math.PI * 2);
    mapCtx.clip();
    // Ground + sea.
    mapCtx.fillStyle = '#264653';
    mapCtx.fillRect(0, 0, size, size);
    mapCtx.fillStyle = '#2a9d8f';
    mapCtx.fillRect(0, mz(106), size, size - mz(106));
    // Blocks.
    mapCtx.fillStyle = '#4a403a';
    for (const bx of CITY.blocks) {
      for (const bz of CITY.blocks) {
        mapCtx.fillRect(mx(bx - 15), mz(bz - 15), 30 * S, 30 * S);
      }
    }
    // Roads.
    mapCtx.strokeStyle = '#d4b896';
    mapCtx.lineWidth = 4;
    for (const road of CITY.roads) {
      mapCtx.beginPath();
      mapCtx.moveTo(mx(road), 0);
      mapCtx.lineTo(mx(road), size);
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(0, mz(road));
      mapCtx.lineTo(size, mz(road));
      mapCtx.stroke();
    }
    // Waypoint: a gold diamond, pulsing.
    const wp = world.missions.waypoint;
    if (wp) {
      const pulse = 6 + Math.sin(world.elapsed * 4) * 2;
      mapCtx.fillStyle = '#f4a900';
      mapCtx.beginPath();
      mapCtx.moveTo(mx(wp.x), mz(wp.z) - pulse);
      mapCtx.lineTo(mx(wp.x) + pulse, mz(wp.z));
      mapCtx.lineTo(mx(wp.x), mz(wp.z) + pulse);
      mapCtx.lineTo(mx(wp.x) - pulse, mz(wp.z));
      mapCtx.fill();
    }
    // Traffic: small grey dots. Police: red/blue flashing dots.
    mapCtx.fillStyle = '#9a8a72';
    for (const car of world.traffic) {
      mapCtx.fillRect(mx(car.x) - 1.5, mz(car.z) - 1.5, 3, 3);
    }
    const flash = Math.floor(world.elapsed * 3) % 2 === 0;
    for (const car of world.police.cars) {
      mapCtx.fillStyle = flash ? '#ff4444' : '#4488ff';
      mapCtx.beginPath();
      mapCtx.arc(mx(car.x), mz(car.z), 4, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // The player: a gold triangle pointing along the heading.
    const player = world.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const pz = player.inCar ? player.inCar.z : player.z;
    const heading = player.inCar ? player.inCar.heading : player.heading;
    mapCtx.fillStyle = '#f4a900';
    mapCtx.save();
    mapCtx.translate(mx(px), mz(pz));
    mapCtx.rotate(Math.atan2(Math.sin(heading), Math.cos(heading)));
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    mapCtx.restore();
    // Ring + district label.
    mapCtx.strokeStyle = '#f4a900';
    mapCtx.lineWidth = 2;
    mapCtx.beginPath();
    mapCtx.arc(size / 2, size / 2, 96, 0, Math.PI * 2);
    mapCtx.stroke();
  }

  return {
    update(world, dt) {
      const player = world.player;
      starsEl.innerHTML = starString(world.wanted.stars, world.wanted.blinking, world.elapsed);
      cashEl.textContent = `$${world.save.cash.toLocaleString('en-US')}`;
      if (world.missions.objective !== lastObjective) {
        objectiveEl.textContent = world.missions.objective;
        lastObjective = world.missions.objective;
        bannerEl.textContent = world.missions.objective;
        bannerEl.classList.add('show');
        bannerTimer = 3.5;
      }
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) bannerEl.classList.remove('show');
      }
      // Dispatch feed: show each new line once.
      while (feedShown < world.feedLog.length) {
        const line = world.feedLog[feedShown];
        feedShown += 1;
        const div = document.createElement('div');
        div.textContent = line;
        feedEl.prepend(div);
        while (feedEl.children.length > 3) feedEl.removeChild(feedEl.lastChild);
      }
      const speed = player.inCar ? Math.abs(player.inCar.speed) * 3.6 : Math.abs(player.speed) * 3.6;
      speedEl.textContent = `${Math.round(speed)}`;
      const health = player.inCar ? player.inCar.health : player.health;
      healthEl.style.width = `${Math.max(0, health)}%`;
      healthEl.style.background = health > 50 ? '#2a9d8f' : health > 25 ? '#f4a900' : '#e76f51';
      // Steal prompt with its hold progress.
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
      drawMinimap(world);
      if (world.fpsSample !== null) fpsEl.textContent = `${world.fpsSample} FPS`;
    },
    show(id) {
      for (const screen of ['title-screen', 'pause-screen', 'complete-screen', 'busted-screen', 'wasted-screen']) {
        $(screen).classList.toggle('show', screen === id);
      }
      $('hud').classList.toggle('show', id === null);
    },
    setTitle(save) {
      $('spec-line').textContent = '1 MISSION READY · 8 CARS · 4 DISTRICTS · 5 WANTED LEVELS · 3 DIFFICULTIES';
      $('best-line').textContent = save.bestGrade
        ? `Best run: grade ${save.bestGrade} in ${save.bestTime}s — $${save.cash.toLocaleString('en-US')} in the pocket.`
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
        `Garage — ${result.garage.join(', ') || 'empty'}`,
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
