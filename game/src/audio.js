// All sound is synthesized with WebAudio — no audio files ship with the
// game. A low engine hum tracks the car's speed, a two-tone siren swells as
// a cruiser closes in, and short blips mark pickups, crimes and mission
// beats. Browsers only let audio start after a user gesture, so the context
// is created lazily on the first unlock.
import { MUTE_KEY } from './config.js';

export function createAudio() {
  let audioCtx = null;
  let masterBus = null;
  let engineVoice = null;
  let engineLevel = null;
  let sirenVoice = null;
  let sirenLevel = null;
  let sirenClock = 0;
  let silenced = false;
  try {
    silenced = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    silenced = false;
  }

  // Build the graph on first gesture; later calls just wake a suspended one.
  function unlock() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
      return;
    }
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterBus = audioCtx.createGain();
      masterBus.gain.value = silenced ? 0 : 0.16;
      masterBus.connect(audioCtx.destination);
      engineVoice = audioCtx.createOscillator();
      engineVoice.type = 'sawtooth';
      engineVoice.frequency.value = 55;
      const engineFilter = audioCtx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineLevel = audioCtx.createGain();
      engineLevel.gain.value = 0;
      engineVoice.connect(engineFilter).connect(engineLevel).connect(masterBus);
      engineVoice.start();
      sirenVoice = audioCtx.createOscillator();
      sirenVoice.type = 'square';
      sirenVoice.frequency.value = 700;
      sirenLevel = audioCtx.createGain();
      sirenLevel.gain.value = 0;
      sirenVoice.connect(sirenLevel).connect(masterBus);
      sirenVoice.start();
    } catch {
      audioCtx = null;
    }
  }

  // One short tone that fades out — the building block for every blip.
  function blip(freq, dur = 0.12, type = 'sine') {
    if (!audioCtx || silenced) return;
    try {
      const osc = audioCtx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
      osc.connect(gain).connect(masterBus);
      osc.start();
      osc.stop(audioCtx.currentTime + dur);
    } catch {
      // Audio is decoration; a failure never breaks the game.
    }
  }

  // A burst of white noise for crashes.
  function crash() {
    if (!audioCtx || silenced) return;
    try {
      const len = audioCtx.sampleRate * 0.18;
      const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = audioCtx.createBufferSource();
      src.buffer = buffer;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.7;
      src.connect(gain).connect(masterBus);
      src.start();
    } catch {
      // See above.
    }
  }

  return {
    unlock,
    get muted() { return silenced; },
    toggleMute() {
      silenced = !silenced;
      try {
        window.localStorage.setItem(MUTE_KEY, silenced ? '1' : '0');
      } catch {
        // Non-fatal.
      }
      if (masterBus) masterBus.gain.value = silenced ? 0 : 0.16;
      return silenced;
    },
    blip,
    crash,
    mission: () => { blip(660, 0.14); setTimeout(() => blip(880, 0.2), 130); },
    crime: () => blip(180, 0.25, 'square'),
    // Per-frame: engine pitch follows speed, siren follows the nearest cruiser.
    update(speedKmh, nearestCopDist) {
      if (!audioCtx || silenced) return;
      try {
        const engineTarget = speedKmh > 1 ? 0.05 + Math.min(0.16, speedKmh / 900) : 0;
        engineLevel.gain.setTargetAtTime(engineTarget, audioCtx.currentTime, 0.1);
        engineVoice.frequency.setTargetAtTime(55 + speedKmh * 1.1, audioCtx.currentTime, 0.1);
        sirenClock += 1 / 60;
        const tone = Math.floor(sirenClock * 1.4) % 2 === 0 ? 700 : 950;
        sirenVoice.frequency.setTargetAtTime(tone, audioCtx.currentTime, 0.05);
        const sirenTarget = nearestCopDist < 90 ? Math.max(0, 0.09 * (1 - nearestCopDist / 90)) : 0;
        sirenLevel.gain.setTargetAtTime(sirenTarget, audioCtx.currentTime, 0.2);
      } catch {
        // See above.
      }
    },
  };
}
