// Procedural WebAudio: engine hum, sirens, coin chime, thuds. No audio files.
export function createAudio() {
  let ctx = null, master = null, engineOsc = null, engineGain = null, sirenOsc = null, sirenGain = null, sirenLfo = null;
  let started = false;

  function start() {
    if (started) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 720;
      sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'square';
      sirenLfo.frequency.value = 0.8;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 190;
      sirenLfo.connect(lfoGain); lfoGain.connect(sirenOsc.frequency);
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(master);
      sirenOsc.start(); sirenLfo.start();
      started = true;
    } catch (e) { /* audio unavailable: game stays silent */ }
  }

  function blip(freq, dur, vol, type) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(master);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  function thud(vol) {
    if (!ctx) return;
    const len = ctx.sampleRate * 0.18;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = vol || 0.4;
    src.connect(g); g.connect(master);
    src.start();
  }

  return {
    start,
    engine(speed, driving) {
      if (!ctx) return;
      engineGain.gain.value = driving ? 0.05 + Math.min(0.12, Math.abs(speed) * 0.003) : 0.02;
      engineOsc.frequency.value = 52 + Math.abs(speed) * 3.2;
    },
    siren(on) { if (ctx) sirenGain.gain.value = on ? 0.035 : 0; },
    coin() { blip(1320, 0.12, 0.3); setTimeout(() => blip(1760, 0.18, 0.3), 90); },
    pickup() { blip(880, 0.1, 0.25); },
    crash() { thud(0.5); },
    punch() { thud(0.25); },
    click() { blip(660, 0.06, 0.2, 'square'); },
    busted() { blip(220, 0.5, 0.3, 'sawtooth'); },
  };
}
