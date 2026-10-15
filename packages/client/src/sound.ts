/** Tiny synthesized sound effects (original, no audio files). */
let ctx: AudioContext | null = null;
let enabled = readEnabled();

function readEnabled(): boolean {
  try {
    return localStorage.getItem('hex-sound') !== 'off';
  } catch {
    return true;
  }
}

export function soundEnabled() {
  return enabled;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem('hex-sound', on ? 'on' : 'off');
  } catch {
    /* ignore */
  }
}

function audio(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, duration: number, type: OscillatorType = 'sine', gain = 0.15) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, a.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, a.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + duration);
  osc.connect(g).connect(a.destination);
  osc.start(a.currentTime + start);
  osc.stop(a.currentTime + start + duration + 0.05);
}

export const sfx = {
  dice() {
    for (let i = 0; i < 6; i++) tone(180 + Math.random() * 220, i * 0.07, 0.05, 'square', 0.05);
  },
  build() {
    tone(392, 0, 0.12, 'triangle');
    tone(587, 0.08, 0.18, 'triangle');
  },
  gain() {
    tone(784, 0, 0.1, 'sine', 0.1);
    tone(1046, 0.07, 0.14, 'sine', 0.1);
  },
  turn() {
    tone(523, 0, 0.15, 'sine');
    tone(659, 0.12, 0.15, 'sine');
    tone(784, 0.24, 0.25, 'sine');
  },
  error() {
    tone(220, 0, 0.18, 'sawtooth', 0.06);
  },
  robber() {
    tone(196, 0, 0.25, 'sawtooth', 0.07);
    tone(147, 0.18, 0.35, 'sawtooth', 0.07);
  },
  win() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * 0.13, 0.25, 'triangle', 0.12));
  },
};
