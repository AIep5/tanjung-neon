// Audio — real WebAudio synth, no files. Rain is looped filtered noise,
// the engine is an oscillator whose pitch follows speed, the siren is a
// two-tone LFO, UI blips are short envelopes, and a quiet lo-fi pentatonic
// pad plucks on a timer. AudioContext is created ONLY inside ensure(), called
// from a user gesture. Everything is guarded: no AudioContext, no throw.

const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

export function createAudio() {
  let context = null;
  let master = null;
  let rainGain = null;
  let rainFilter = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenLfo = null;
  let sirenGain = null;
  let sirenOn = false;
  let muted = false;
  let padTimer = null;
  let padStep = 0;

  function buildGraph() {
    master = context.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(context.destination);

    // --- rain: 2 s white-noise buffer, looped through a lowpass ---
    const len = context.sampleRate * 2;
    const buf = context.createBuffer(1, len, context.sampleRate);
    const data = buf.getChannelData(0);
    let seed = 1234567;
    for (let i = 0; i < len; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = seed / 1073741824 - 1;
    }
    const noise = context.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    rainFilter = context.createBiquadFilter();
    rainFilter.type = 'lowpass';
    rainFilter.frequency.value = 1400;
    rainGain = context.createGain();
    rainGain.gain.value = 0;
    noise.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    noise.start();

    // --- engine: sawtooth through a lowpass, pitch follows speed ---
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();

    // --- siren: square wave, LFO swings it between two tones ---
    sirenOsc = context.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 800;
    sirenLfo = context.createOscillator();
    sirenLfo.type = 'sine';
    sirenLfo.frequency.value = 0.9;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 160;
    sirenLfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = context.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    sirenLfo.start();

    // --- lo-fi pad: quiet pentatonic plucks on a slow timer ---
    padTimer = setInterval(() => {
      if (!context || context.state !== 'running' || muted) return;
      try {
        const freq = PENTA[padStep % PENTA.length];
        padStep += 1;
        const osc = context.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const g = context.createGain();
        g.gain.setValueAtTime(0.045, context.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 1.6);
        osc.connect(g);
        g.connect(master);
        osc.start();
        osc.stop(context.currentTime + 1.7);
        // Soft fifth below, every other pluck.
        if (padStep % 2 === 0) {
          const low = context.createOscillator();
          low.type = 'sine';
          low.frequency.value = freq / 2;
          const lg = context.createGain();
          lg.gain.setValueAtTime(0.03, context.currentTime);
          lg.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 2.2);
          low.connect(lg);
          lg.connect(master);
          low.start();
          low.stop(context.currentTime + 2.3);
        }
      } catch {
        // A pluck failing must never break the game loop.
      }
    }, 950);
  }

  return {
    get muted() {
      return muted;
    },
    set muted(value) {
      muted = !!value;
      try {
        if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.5, context.currentTime, 0.05);
      } catch {
        // No context yet: the flag alone is enough.
      }
    },
    /** AudioContext state for playtests ('' when not created). */
    get state() {
      return context ? context.state : '';
    },
    /** Call from a user gesture; creates the AudioContext if the browser allows it. */
    ensure() {
      if (context) {
        if (context.state === 'suspended') context.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext ?? window.webkitAudioContext;
        if (!AC) return;
        context = new AC();
        buildGraph();
        if (context.state === 'suspended') context.resume().catch(() => {});
      } catch {
        context = null;
      }
    },
    /** Rain noise level 0..1. */
    setRain(level) {
      const v = Math.max(0, Math.min(1, level));
      try {
        if (rainGain && context) rainGain.gain.setTargetAtTime(v * 0.16, context.currentTime, 0.2);
      } catch {
        // Not initialised yet: ignore.
      }
    },
    /** Engine hum from speed 0..520. */
    engine(speed) {
      try {
        if (!engineOsc || !context) return;
        const s = Math.max(0, Math.min(520, Math.abs(speed)));
        engineOsc.frequency.setTargetAtTime(55 + s * 0.42, context.currentTime, 0.08);
        engineGain.gain.setTargetAtTime(s < 8 ? 0 : 0.02 + (s / 520) * 0.05, context.currentTime, 0.1);
      } catch {
        // Not initialised yet: ignore.
      }
    },
    /** Police siren on/off. */
    siren(on) {
      sirenOn = !!on;
      try {
        if (sirenGain && context) sirenGain.gain.setTargetAtTime(sirenOn ? 0.035 : 0, context.currentTime, 0.15);
      } catch {
        // Not initialised yet: ignore.
      }
    },
    /** Short UI blip. */
    beep() {
      try {
        if (!context || context.state !== 'running') return;
        const osc = context.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 880;
        const g = context.createGain();
        g.gain.setValueAtTime(0.06, context.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.09);
        osc.connect(g);
        g.connect(master);
        osc.start();
        osc.stop(context.currentTime + 0.1);
      } catch {
        // Not initialised yet: ignore.
      }
    },
  };
}
