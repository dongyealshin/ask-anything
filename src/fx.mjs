import { reducedMotion } from './dom.mjs';

let ctx2d = null;
let parts = [];
let raf = 0;

function setup() {
  const cv = document.getElementById('fx');
  if (!cv) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.floor(window.innerWidth * dpr);
  cv.height = Math.floor(window.innerHeight * dpr);
  ctx2d = cv.getContext('2d');
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx2d;
}

window.addEventListener('resize', () => { if (parts.length) setup(); });

function loop() {
  const c = ctx2d;
  if (!c) { raf = 0; return; }
  const w = window.innerWidth;
  const h = window.innerHeight;
  c.clearRect(0, 0, w, h);
  parts = parts.filter((p) => p.life > 0 && p.y < h + 80);
  for (const p of parts) {
    p.life -= 1 / 60;
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vrot;
    c.save();
    c.globalAlpha = Math.max(0, Math.min(1, p.life / p.fade));
    c.translate(p.x, p.y);
    c.rotate(p.rot);
    c.font = `${p.size}px serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(p.ch, 0, 0);
    c.restore();
  }
  if (parts.length) {
    raf = requestAnimationFrame(loop);
  } else {
    c.clearRect(0, 0, w, h);
    raf = 0;
  }
}

function start() {
  if (!ctx2d) setup();
  if (!raf) raf = requestAnimationFrame(loop);
}

/** origin을 주면 그 지점에서, 없으면 화면 상단 1/3 지점에서 분출한다 */
export function burst(emoji, rarity = 1, origin = null) {
  if (reducedMotion()) return;
  const count = rarity >= 3 ? 140 : rarity === 2 ? 90 : 60;
  const ch = emoji || '✨';
  const ox = origin ? origin.x : window.innerWidth / 2;
  const oy = origin ? origin.y : window.innerHeight * 0.34;
  for (let i = 0; i < count; i++) {
    // 위쪽 반원 전체로 넓게 퍼뜨려 결과 문구를 가리지 않게 한다
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const sp = 8 + Math.random() * 13;
    parts.push({
      ch,
      x: ox + (Math.random() - 0.5) * 60,
      y: oy + (Math.random() - 0.5) * 40,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      g: 0.12 + Math.random() * 0.06,
      size: 14 + Math.random() * 20,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.22,
      life: 1.3 + Math.random() * 0.9,
      fade: 1.0,
    });
  }
  start();
}

export function rain(emoji, count = 40) {
  if (reducedMotion()) return;
  const ch = emoji || '✨';
  for (let i = 0; i < count; i++) {
    parts.push({
      ch,
      x: Math.random() * window.innerWidth,
      y: -40 - Math.random() * 380,
      vx: (Math.random() - 0.5) * 1.4,
      vy: 1.5 + Math.random() * 2.5,
      g: 0.03,
      size: 16 + Math.random() * 16,
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.1,
      life: 2.6,
      fade: 2.6,
    });
  }
  start();
}

export function flash() {
  const node = document.createElement('div');
  node.className = reducedMotion() ? 'fx-flash soft' : 'fx-flash';
  document.body.append(node);
  node.addEventListener('animationend', () => node.remove(), { once: true });
  setTimeout(() => node.remove(), 1200);
}

export function shake() {
  if (reducedMotion()) return;
  const app = document.getElementById('app');
  if (!app) return;
  app.classList.remove('shaking');
  void app.offsetWidth;
  app.classList.add('shaking');
  app.addEventListener('animationend', () => app.classList.remove('shaking'), { once: true });
}
