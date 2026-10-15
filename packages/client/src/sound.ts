/**
 * Sound and haptics. Every sound is synthesized with Web Audio (noise bursts
 * through filters, struck-wood resonators, bell partials), so there are no
 * audio files to download and nothing is licensed from anyone.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) !== 'off';
  } catch {
    return true;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

function readVolume(): number {
  try {
    const raw = localStorage.getItem('hex-volume');
    if (raw !== null) return Math.min(1, Math.max(0, Number(raw)));
    return localStorage.getItem('hex-sound') === 'off' ? 0 : 0.7;
  } catch {
    return 0.7;
  }
}

let volume = readVolume();
let soundOn = volume > 0;
let vibrateOn = readFlag('hex-vibrate');

export const soundEnabled = () => soundOn;
export const vibrationEnabled = () => vibrateOn;
export const getVolume = () => volume;

/** Effects volume, 0 (silent) to 1. */
export function setVolume(v: number) {
  volume = Math.min(1, Math.max(0, v));
  soundOn = volume > 0;
  if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  try {
    localStorage.setItem('hex-volume', String(volume));
  } catch {
    /* ignore */
  }
}

export function setSoundEnabled(on: boolean) {
  setVolume(on ? Math.max(volume, 0.7) : 0);
}
export function setVibrationEnabled(on: boolean) {
  vibrateOn = on;
  writeFlag('hex-vibrate', on);
}
export const canVibrate = () => typeof navigator !== 'undefined' && 'vibrate' in navigator;

function audio(): AudioContext | null {
  if (!soundOn) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    // Gentle compression keeps stacked effects from clipping on phone speakers.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp).connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Unlocks audio on the first user gesture (required on iOS). */
export function unlockAudio() {
  audio();
}

function env(a: AudioContext, node: AudioNode, at: number, peak: number, attack: number, decay: number) {
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  node.connect(g).connect(master!);
  return g;
}

/** Filtered noise burst: clicks, rattles, swishes. */
function noise(delay: number, dur: number, freq: number, q: number, peak: number, type: BiquadFilterType = 'bandpass', sweepTo?: number) {
  const a = audio();
  if (!a || !noiseBuffer) return;
  const at = a.currentTime + delay;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  f.Q.value = q;
  src.connect(f);
  env(a, f, at, peak, Math.min(0.006, dur / 4), dur);
  src.start(at, Math.random() * 0.5);
  src.stop(at + dur + 0.05);
}

/** A struck resonant body (wood, stone). */
function knock(delay: number, freq: number, peak: number, decay = 0.12) {
  const a = audio();
  if (!a) return;
  const at = a.currentTime + delay;
  for (const [mult, gain] of [
    [1, 1],
    [2.76, 0.35],
    [5.4, 0.12],
  ]) {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * mult * 1.08, at);
    o.frequency.exponentialRampToValueAtTime(freq * mult, at + 0.03);
    env(a, o, at, peak * gain, 0.002, decay / mult);
    o.start(at);
    o.stop(at + decay + 0.05);
  }
  noise(delay, 0.02, freq * 6, 1.5, peak * 0.5);
}

/** Bell / chime partials. */
function bell(delay: number, freq: number, peak: number, decay = 0.8) {
  const a = audio();
  if (!a) return;
  const at = a.currentTime + delay;
  for (const [mult, gain] of [
    [1, 1],
    [2, 0.4],
    [3.01, 0.22],
    [4.2, 0.1],
  ]) {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * mult;
    env(a, o, at, peak * gain, 0.004, decay / Math.sqrt(mult));
    o.start(at);
    o.stop(at + decay + 0.1);
  }
}

function tone(delay: number, freq: number, dur: number, type: OscillatorType, peak: number, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const at = a.currentTime + delay;
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  env(a, o, at, peak, 0.01, dur);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function buzz(pattern: number | number[]) {
  if (vibrateOn && canVibrate()) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }
}

export const sfx = {
  /** Dice shaken, then tumbling across the wooden table. */
  dice() {
    for (let i = 0; i < 7; i++) noise(i * 0.045, 0.03, 2200 + Math.random() * 1800, 3, 0.25);
    const hits = [0.38, 0.5, 0.58, 0.66, 0.72, 0.77];
    hits.forEach((t, i) => knock(t, 520 + Math.random() * 260, 0.32 * (1 - i * 0.12), 0.07));
    buzz([0, 380, 25, 90, 20]);
  },
  /** Dice rattling in a hand before the throw. */
  diceShake() {
    for (let i = 0; i < 6; i++) noise(i * 0.04, 0.028, 2400 + Math.random() * 1600, 3, 0.2);
    buzz(30);
  },
  /** A die hitting the board; louder for harder impacts. */
  diceHit(strength: number) {
    knock(0, 480 + Math.random() * 320, 0.12 + strength * 0.38, 0.05 + strength * 0.04);
    if (strength > 0.5) buzz(Math.round(10 + strength * 20));
  },
  /** One resource card slides into a hand. */
  card(delay = 0) {
    noise(delay, 0.11, 5200, 0.9, 0.18, 'bandpass', 1600);
    tone(delay + 0.08, 1320, 0.09, 'sine', 0.05);
  },
  /** Several cards arriving after a roll. */
  gain(count = 1) {
    for (let i = 0; i < Math.min(count, 6); i++) sfx.card(0.55 + i * 0.09);
    bell(0.55 + Math.min(count, 6) * 0.09, 1568, 0.07, 0.5);
  },
  /** Wooden piece placed on the board. */
  build() {
    knock(0, 210, 0.55, 0.16);
    knock(0.06, 330, 0.25, 0.08);
    buzz(18);
  },
  road() {
    knock(0, 300, 0.4, 0.09);
    knock(0.05, 260, 0.3, 0.09);
    buzz(14);
  },
  city() {
    knock(0, 180, 0.6, 0.18);
    knock(0.09, 240, 0.4, 0.12);
    bell(0.16, 784, 0.12, 0.7);
    bell(0.26, 1175, 0.08, 0.7);
    buzz([20, 40, 30]);
  },
  /** Heavy stone pawn landing. */
  robber() {
    tone(0, 110, 0.45, 'sine', 0.35, 55);
    knock(0.02, 95, 0.5, 0.25);
    noise(0.02, 0.35, 300, 0.7, 0.12, 'lowpass');
    buzz(60);
  },
  /** A card snatched away. */
  steal() {
    noise(0, 0.16, 1800, 1.2, 0.22, 'bandpass', 6000);
    tone(0.12, 660, 0.12, 'triangle', 0.08, 990);
  },
  /** You were robbed. */
  robbed() {
    noise(0, 0.16, 1800, 1.2, 0.22, 'bandpass', 6000);
    tone(0.1, 330, 0.25, 'sawtooth', 0.06, 196);
    buzz([0, 80, 60, 80]);
  },
  /** Cards and coins changing hands. */
  trade() {
    sfx.card(0);
    sfx.card(0.12);
    bell(0.2, 2093, 0.06, 0.35);
    bell(0.27, 2637, 0.05, 0.35);
  },
  /** Drawing a development card: paper flip and a little sparkle. */
  devCard() {
    noise(0, 0.08, 3500, 1, 0.18, 'bandpass', 900);
    noise(0.09, 0.07, 2800, 1, 0.14, 'bandpass', 900);
    [1047, 1319, 1568].forEach((f, i) => bell(0.18 + i * 0.07, f, 0.06, 0.5));
  },
  /** Playing a development card: a short fanfare flourish. */
  playCard() {
    noise(0, 0.1, 3000, 1, 0.16, 'bandpass', 900);
    [523, 659, 784].forEach((f, i) => tone(0.08 + i * 0.09, f, 0.22, 'triangle', 0.1));
  },
  /** Longest Road / Largest Army. */
  award() {
    [523, 659, 784, 1047].forEach((f, i) => tone(i * 0.1, f, 0.3, 'triangle', 0.12));
    bell(0.42, 1568, 0.1, 1.2);
    buzz([0, 60, 50, 60, 50, 120]);
  },
  /** It's your turn. */
  turn() {
    bell(0, 784, 0.12, 0.9);
    bell(0.14, 1175, 0.1, 1.1);
    buzz([0, 40, 60, 40]);
  },
  /** Cards returned to the supply. */
  discard() {
    for (let i = 0; i < 3; i++) noise(i * 0.07, 0.09, 4200, 0.9, 0.12, 'bandpass', 1400);
  },
  error() {
    tone(0, 220, 0.16, 'square', 0.05, 180);
    buzz(40);
  },
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(i * 0.13, f, 0.32, 'triangle', 0.12));
    bell(0.95, 2093, 0.12, 1.6);
    buzz([0, 100, 60, 100, 60, 200]);
  },
};
