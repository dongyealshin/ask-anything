let ctx = null;
let enabled = true;

try { enabled = localStorage.getItem('aa-sound') !== 'off'; } catch { /* 저장소 차단 시 기본 켜짐 */ }

function ac() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  } catch {
    return null;
  }
}

export function sfxEnabled() { return enabled; }

export function sfxSetEnabled(on) {
  enabled = !!on;
  try { localStorage.setItem('aa-sound', enabled ? 'on' : 'off'); } catch { /* 무시 */ }
}

function tone({ type = 'sine', from, to, dur = 0.3, gain = 0.16, delay = 0 }) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to && to !== from) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur = 0.18, freq = 1200) {
  const c = ac();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.value = 0.13;
  src.connect(bp).connect(g).connect(c.destination);
  src.start();
}

export function sfxPlay(name) {
  if (!enabled) return;
  try {
    if (name === 'shuffle') {
      noise(0.16, 1400);
      setTimeout(() => noise(0.13, 1100), 140);
      setTimeout(() => noise(0.11, 900), 280);
    } else if (name === 'pick') {
      tone({ from: 660, to: 880, dur: 0.12, gain: 0.12 });
    } else if (name === 'reveal') {
      tone({ type: 'triangle', from: 440, to: 1320, dur: 0.35, gain: 0.14 });
    } else if (name === 'jackpot') {
      [523.25, 659.25, 783.99].forEach((f, i) => {
        tone({ from: f, to: f, dur: 0.6, gain: 0.09, delay: i * 0.07 });
      });
    }
  } catch { /* 오디오 실패는 무시 */ }
}

export function vibrate(rarity) {
  try { navigator.vibrate?.(rarity >= 3 ? [40, 60, 90] : 30); } catch { /* 무시 */ }
}
