// افکت‌های صوتی ساخته‌شده با WebAudio (بدون فایل صوتی خارجی؛ کاملاً آفلاین)
let ctx = null;
let master = null;
let enabled = true;
let volume = 0.7;

function ensure() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.value = volume;
    return ctx;
  } catch (_) {
    return null;
  }
}

export function configureSound({ sound, volume: v }) {
  enabled = !!sound;
  volume = Math.max(0, Math.min(1, v ?? 0.7));
  if (master) master.gain.value = volume;
}

function tone(freq, start, dur, { type = 'sine', gain = 0.3, slideTo = null } = {}) {
  const c = ensure();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start, dur, { gain = 0.25, freq = 1800, q = 0.8 } = {}) {
  const c = ensure();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  const t = c.currentTime + start;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  click: () => tone(660, 0, 0.06, { type: 'triangle', gain: 0.18 }),
  dice: () => {
    for (let i = 0; i < 7; i++) noise(i * 0.075, 0.05, { gain: 0.3, freq: 1200 + Math.random() * 1800 });
  },
  move: () => {
    tone(180, 0, 0.09, { type: 'sine', gain: 0.35, slideTo: 90 });
    noise(0, 0.04, { gain: 0.18, freq: 900 });
  },
  hit: () => {
    tone(140, 0, 0.18, { type: 'square', gain: 0.18, slideTo: 60 });
    noise(0, 0.12, { gain: 0.3, freq: 600 });
  },
  bearOff: () => {
    tone(520, 0, 0.08, { type: 'triangle', gain: 0.22 });
    tone(780, 0.07, 0.1, { type: 'triangle', gain: 0.22 });
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.28, { type: 'triangle', gain: 0.28 })),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, i * 0.18, 0.3, { type: 'sine', gain: 0.25 })),
  error: () => tone(200, 0, 0.14, { type: 'sawtooth', gain: 0.12, slideTo: 140 }),
  good: () => {
    tone(660, 0, 0.09, { type: 'triangle', gain: 0.22 });
    tone(880, 0.09, 0.14, { type: 'triangle', gain: 0.22 });
  },
};
