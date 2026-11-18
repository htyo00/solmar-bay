// Every sound is synthesized live with WebAudio — no audio files ship
// with the game. A low engine hum follows the car's speed, a two-tone
// siren swells as a cruiser closes in, and short blips mark pickups,
// crimes and mission beats. Browsers only allow audio after a user
// gesture, so the audio context is built lazily on the first unlock.
import { MUTE_KEY } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTime = 0;
  let muted = false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }

  // Build the graph on the first gesture; later calls just wake it up.
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
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(lowpass).connect(engineGain).connect(master);
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

  // One short tone that fades away — the building block of every blip.
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

  // A burst of white noise for crashes.
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

  function flipMute() {
    muted = !muted;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Non-fatal.
    }
    if (master) master.gain.value = muted ? 0 : 0.16;
    return muted;
  }

  function missionJingle() {
    blip(660, 0.14);
    setTimeout(() => blip(880, 0.2), 130);
  }

  // Per-frame: engine pitch follows speed, siren follows the nearest cruiser.
  function update(speedKmh, nearestCopDist) {
    if (!ctx || muted) return;
    try {
      const engineTarget = speedKmh > 1 ? 0.05 + Math.min(0.16, speedKmh / 900) : 0;
      engineGain.gain.setTargetAtTime(engineTarget, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speedKmh * 1.1, ctx.currentTime, 0.1);
      sirenTime += 1 / 60;
      const tone = Math.floor(sirenTime * 1.4) % 2 === 0 ? 700 : 950;
      sirenOsc.frequency.setTargetAtTime(tone, ctx.currentTime, 0.05);
      const sirenTarget = nearestCopDist < 90 ? Math.max(0, 0.09 * (1 - nearestCopDist / 90)) : 0;
      sirenGain.gain.setTargetAtTime(sirenTarget, ctx.currentTime, 0.2);
    } catch {
      // See above.
    }
  }

  return {
    unlock,
    get muted() { return muted; },
    toggleMute: flipMute,
    blip,
    crash,
    mission: missionJingle,
    crime: () => blip(180, 0.25, 'square'),
    update,
  };
}
