// Procedural WebAudio: no sound files, everything synthesized. A low engine
// hum that follows the car's speed, a two-tone police siren that swells as a
// cruiser closes in, and short blips for pickups, crimes and mission beats.
// The context only starts on the first user gesture, as browsers require.
import { MUTE_KEY } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.16;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter).connect(engineGain).connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
  }

  function blip(freq, dur = 0.12, type = 'sine') {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  function crash() {
    if (!ctx || muted) return;
    try {
      const len = ctx.sampleRate * 0.18;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.7;
      src.connect(gain).connect(master);
      src.start();
    } catch {
      // See above.
    }
  }

  return {
    unlock,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Non-fatal.
      }
      if (master) master.gain.value = muted ? 0 : 0.16;
      return muted;
    },
    blip,
    crash,
    mission: () => { blip(660, 0.14); setTimeout(() => blip(880, 0.2), 130); },
    crime: () => blip(180, 0.25, 'square'),
    /** Per-frame: engine pitch from speed, siren from the nearest cruiser. */
    update(speedKmh, nearestCopDist) {
      if (!ctx || muted) return;
      try {
        const target = speedKmh > 1 ? 0.05 + Math.min(0.16, speedKmh / 900) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.1, ctx.currentTime, 0.1);
        sirenTimer += 1 / 60;
        const tone = Math.floor(sirenTimer * 1.4) % 2 === 0 ? 700 : 950;
        sirenOsc.frequency.setTargetAtTime(tone, ctx.currentTime, 0.05);
        const sirenTarget = nearestCopDist < 90 ? Math.max(0, 0.09 * (1 - nearestCopDist / 90)) : 0;
        sirenGain.gain.setTargetAtTime(sirenTarget, ctx.currentTime, 0.2);
      } catch {
        // See above.
      }
    },
  };
}
