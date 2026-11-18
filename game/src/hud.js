// HUD: minimap, bars, stars, cash, prompts, and every overlay screen.
// All DOM is built here so index.html stays a thin shell.
import { CFG } from './config.js';
import { DISTRICTS } from './city.js';
import { MISSION_LIST as ML } from './missions.js';

const CSS = `
#hud{position:fixed;inset:0;pointer-events:none;font-family:'Segoe UI',system-ui,sans-serif;color:#fff;z-index:5}
#objective{position:absolute;top:14px;left:16px;text-shadow:0 2px 6px #000}
#objective h2{margin:0;font-size:15px;letter-spacing:2px;color:#ffd23c}
#objective p{margin:2px 0 0;font-size:15px}
#topright{position:absolute;top:14px;right:16px;text-align:right;text-shadow:0 2px 6px #000}
#stars{font-size:26px;letter-spacing:3px;color:#3a3a44}
#stars .on{color:#ffd23c;text-shadow:0 0 12px #ffd23c}
#stars.search .on{animation:blink .5s steps(2) infinite}
@keyframes blink{50%{opacity:.25}}
#cash{font-size:20px;font-weight:700}
#cash small{color:#9fe8a9;font-size:13px}
#mmwrap{position:absolute;left:16px;bottom:16px}
#minimap{border:2px solid rgba(255,255,255,.35);border-radius:50%;background:#0b0b1e;box-shadow:0 0 0 4px rgba(0,0,0,.45)}
.bar{height:9px;border-radius:5px;background:rgba(0,0,0,.55);margin-top:5px;overflow:hidden;width:190px}
.bar i{display:block;height:100%}
#hp i{background:#37d67a}#ar i{background:#3a9bff}#sp i{background:#ffd23c}
#speedo{position:absolute;right:18px;bottom:18px;text-align:right;text-shadow:0 2px 6px #000}
#speedo b{font-size:30px}
#nitro{width:150px;height:9px;background:rgba(0,0,0,.55);border-radius:5px;overflow:hidden;margin-top:4px}
#nitro i{display:block;height:100%;background:#35e0ff}
#prompt{position:absolute;left:50%;bottom:22%;transform:translateX(-50%);font-size:17px;background:rgba(0,0,0,.65);padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,.3)}
#toast{position:absolute;left:50%;top:18%;transform:translateX(-50%);font-size:19px;font-weight:700;color:#ffd23c;text-shadow:0 2px 8px #000;opacity:0;transition:opacity .3s}
.overlay{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(4,4,16,.55);pointer-events:auto;text-align:center;z-index:10}
.overlay h1{font-size:64px;margin:0;letter-spacing:6px;color:#fff;text-shadow:0 0 30px #ff2e88,0 4px 0 #000}
.overlay h1 .bay{color:#35e0ff;text-shadow:0 0 30px #35e0ff}
.overlay p{font-size:17px;color:#d8d8e8;max-width:640px;line-height:1.5}
.overlay .keys{font-size:14px;color:#9a9ab0}
.overlay .big{font-size:90px;color:#ffd23c;margin:0;text-shadow:0 0 40px #ffd23c}
#maptab .panel{display:flex;gap:24px;background:rgba(8,8,22,.92);border:1px solid #35e0ff55;border-radius:12px;padding:22px}
#maptab .stats{text-align:left;font-size:15px;line-height:1.9}
#maptab .stats b{color:#ffd23c}
#maptab .card{border-left:3px solid #ffd23c;padding-left:14px;text-align:left}
#maptab .card h3{margin:0 0 6px;color:#ffd23c;letter-spacing:2px}
#maptab .card .lock{color:#777;font-size:13px}
`;

export function createHud(G) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const root = document.createElement('div');
  root.id = 'hud';
  root.innerHTML = `
    <div id="objective"><h2 id="objName">SOLMAR BAY</h2><p id="objText"></p></div>
    <div id="topright"><div id="stars"></div><div id="cash"></div></div>
    <div id="mmwrap"><canvas id="minimap" width="190" height="190"></canvas>
      <div class="bar" id="hp"><i></i></div>
      <div class="bar" id="ar"><i></i></div>
      <div class="bar" id="sp"><i></i></div>
    </div>
    <div id="speedo" style="display:none"><b id="speed">0</b> mph<div id="nitro"><i></i></div></div>
    <div id="prompt" style="display:none"></div>
    <div id="toast"></div>`;
  document.body.appendChild(root);

  const mm = root.querySelector('#minimap');
  const mmCtx = mm.getContext('2d');
  const $ = (id) => root.querySelector(id);
  let special = 0, toastT = 0, lastObj = '';

  function overlay(id, html) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'overlay';
      document.body.appendChild(el);
    }
    el.innerHTML = html;
    el.style.display = 'flex';
    return el;
  }
  function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

  function drawMap(ctx, size) {
    const S = size / 560, ox = size / 2, oy = size / 2;
    const X = (x) => ox + x * S, Z = (z) => oy + z * S;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0b0b1e'; ctx.fillRect(0, 0, size, size);
    // water + beach
    ctx.fillStyle = '#06283a'; ctx.fillRect(X(262), 0, size - X(262), size);
    ctx.fillStyle = '#8a7a55'; ctx.fillRect(X(200), 0, X(262) - X(200), size);
    // districts
    for (const d of DISTRICTS) {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(X(d.x0), Z(d.z0), (d.x1 - d.x0) * S, (d.z1 - d.z0) * S);
    }
    // roads
    ctx.strokeStyle = '#3d3d4d'; ctx.lineWidth = Math.max(2, 13 * S);
    for (const l of CFG.roadLines) {
      ctx.beginPath(); ctx.moveTo(X(l), 0); ctx.lineTo(X(l), size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Z(l)); ctx.lineTo(size, Z(l)); ctx.stroke();
    }
    // pier
    ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = Math.max(3, 12 * S);
    ctx.beginPath(); ctx.moveTo(X(200), Z(100)); ctx.lineTo(X(322), Z(100)); ctx.stroke();
    // coins
    ctx.fillStyle = '#ffc233';
    for (const c of G.world.coins) {
      if (c.taken) continue;
      ctx.beginPath(); ctx.arc(X(c.x), Z(c.z), 3.5, 0, 7); ctx.fill();
    }
    // objective
    const t = G.missions.target;
    if (G.missions.active && !G.missions.done) {
      const p = 0.5 + Math.sin(G.time * 5) * 0.5;
      ctx.fillStyle = `rgba(255,210,60,${0.5 + p * 0.5})`;
      ctx.beginPath(); ctx.arc(X(t.x), Z(t.z), 6 + p * 3, 0, 7); ctx.fill();
    }
    // police
    for (const c of G.police.cruisers) {
      ctx.fillStyle = '#ff3344';
      ctx.beginPath(); ctx.arc(X(c.pos.x), Z(c.pos.z), 3.5, 0, 7); ctx.fill();
    }
    for (const c of G.police.foot) {
      ctx.fillStyle = '#4488ff';
      ctx.beginPath(); ctx.arc(X(c.pos.x), Z(c.pos.z), 3, 0, 7); ctx.fill();
    }
    // player arrow
    const p = G.player.pos;
    ctx.save();
    ctx.translate(X(p.x), Z(p.z));
    ctx.rotate(-G.player.heading + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function update(dt) {
    const save = G.save;
    // the title screen is the overlay alone: hide the whole HUD behind it
    root.style.visibility = G.state === 'title' ? 'hidden' : 'visible';
    // the minimap + bars stay out of the way on the title screen
    document.getElementById('mmwrap').style.display = G.state === 'title' ? 'none' : 'block';
    // objective
    const txt = G.missions.stepText();
    if (txt !== lastObj) { lastObj = txt; $('#objText').textContent = txt; }
    $('#objName').textContent = G.missions.done ? 'SOLMAR BAY — JOB DONE' : 'MISSION 1/6 — FIRST JOB';
    // stars
    const st = $('#stars');
    let html = '';
    for (let i = 1; i <= 5; i++) html += `<span class="${i <= G.wanted.stars ? 'on' : ''}">★</span>`;
    st.innerHTML = html;
    st.className = G.wanted.searching ? 'search' : '';
    $('#cash').innerHTML = '$' + save.cash.toLocaleString() + ` <small>REP ${save.rep}</small>`;
    // bars
    $('#hp i').style.width = G.player.health + '%';
    $('#ar i').style.width = G.player.armor + '%';
    if (G.player.inCar && Math.abs(G.player.car.speed) > 20) special = Math.min(100, special + dt * 5);
    else special = Math.max(0, special - dt * 2);
    if (special >= 100) {
      special = 0;
      if (G.player.car) G.player.car.nitro = CFG.nitroMax;
      flash('SPECIAL — NITRO REFILLED');
    }
    $('#sp i').style.width = special + '%';
    // speedo
    const sp = $('#speedo');
    if (G.player.inCar) {
      sp.style.display = 'block';
      $('#speed').textContent = Math.round(Math.abs(G.player.car.speed) * 2.2);
      $('#nitro i').style.width = G.player.car.nitro + '%';
    } else sp.style.display = 'none';
    // toast fade
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').style.opacity = 0; }
    drawMap(mmCtx, 190);
    // hurt vignette
    if (G.player.hurtFlash > 0) root.style.boxShadow = 'inset 0 0 90px rgba(255,0,0,.55)';
    else root.style.boxShadow = 'none';
  }

  function flash(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.style.opacity = 1;
    toastT = 2.4;
  }
  function prompt(text) {
    const el = $('#prompt');
    if (!text) { el.style.display = 'none'; return; }
    el.textContent = text;
    el.style.display = 'block';
  }

  function showTitle() {
    overlay('title', `
      <h1>SOLMAR <span class="bay">BAY</span></h1>
      <p>A neon-noir open-world crime story. Dante Cross just got out — the city
      owes him, the cops want him, and the Comet GT outside the Loft is the
      first step to taking it all back.</p>
      <p class="keys">WASD drive / walk &nbsp;·&nbsp; E steal &amp; enter / exit &nbsp;·&nbsp; SHIFT nitro / run
      &nbsp;·&nbsp; F punch &nbsp;·&nbsp; M map &nbsp;·&nbsp; P pause &nbsp;·&nbsp; mouse drag: look</p>
      <p><b>PRESS ENTER TO START</b></p>`);
  }
  function showMap() {
    const el = overlay('maptab', `<div class="panel">
      <canvas id="bigmap" width="460" height="460"></canvas>
      <div><div class="stats">
        <b>DANTE CROSS</b><br>Cash <b>$${G.save.cash.toLocaleString()}</b><br>
        Rep <b>${G.save.rep}</b> · Jobs <b>${G.save.jobs}</b><br>
        Best grade <b>${G.save.bestGrade}</b> · Bay Coins <b>${G.save.coins}/3</b><br>
        Busted <b>${G.save.busted}</b> · Wasted <b>${G.save.wasted}</b>
      </div><div class="card"><h3>MISSION 1/6 — FIRST JOB</h3>
      <p>${ML[0].desc}</p>
      <p>Status: <b>${G.missions.done ? 'COMPLETE — grade ' + G.missions.grade : 'IN PROGRESS — ' + G.missions.stepText()}</b></p>
      ${ML.slice(1).map(m => `<p class="lock">MISSION ${m.n}/6 — ${m.name} 🔒</p>`).join('')}
      </div></div></div>`);
    const bc = el.querySelector('#bigmap');
    drawMap(bc.getContext('2d'), 460);
  }
  function showPause() {
    overlay('pause', `<h1>PAUSED</h1><p>Take a breath, Dante. The city waits.</p>
      <p class="keys">P / ESC resume &nbsp;·&nbsp; M map &nbsp;·&nbsp; E steal &nbsp;·&nbsp; SHIFT nitro</p>
      <p><b>PRESS P TO RESUME</b></p>`);
  }
  function showBusted() {
    overlay('busted', `<h1>BUSTED</h1>
      <p>The Solmar Bay PD caught Dante. Bail and impound: <b>-$${CFG.bustFine}</b>.</p>
      <p><b>PRESS ENTER TO WALK FREE</b></p>`);
  }
  function showWasted() {
    overlay('wasted', `<h1>WASTED</h1>
      <p>Dante went down hard. Hospital bill: <b>-$${CFG.wastedFine}</b>.</p>
      <p><b>PRESS ENTER TO GET UP</b></p>`);
  }
  function showComplete(grade, pay, time) {
    const mm = Math.floor(time / 60), ss = Math.floor(time % 60);
    overlay('complete', `<p style="letter-spacing:4px;color:#ffd23c">MISSION COMPLETE</p>
      <p class="big">${grade}</p>
      <p>FIRST JOB — the Comet GT is at the pier. The Loft pays <b>$${pay}</b>.<br>
      Time ${mm}:${String(ss).padStart(2, '0')} · Jobs done: ${G.save.jobs}</p>
      <p><b>PRESS ENTER TO CONTINUE</b></p>`);
  }
  function hideOverlays() {
    for (const id of ['title', 'maptab', 'pause', 'busted', 'wasted', 'complete']) hide(id);
  }

  return {
    update, flash, prompt, showTitle, showMap, showPause,
    showBusted, showWasted, showComplete, hideOverlays,
  };
}
