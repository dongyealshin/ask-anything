import { reducedMotion } from './dom.mjs';

// 이모지는 컬러 비트맵이라 fillText 비용이 크고, 크기가 매번 다르면 글리프 캐시가
// 통째로 미스된다. 이모지당 한 번만 스프라이트로 굽고 drawImage로 그린다.
const SPRITE = 72;
const sprites = new Map();
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';

function sprite(ch) {
  let s = sprites.get(ch);
  if (s) return s;
  if (sprites.size >= 12) sprites.clear();
  s = document.createElement('canvas');
  s.width = s.height = SPRITE;
  const g = s.getContext('2d');
  g.font = `${Math.floor(SPRITE * 0.78)}px ${EMOJI_FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(ch, SPRITE / 2, SPRITE / 2);
  sprites.set(ch, s);
  return s;
}

// 전체화면 캔버스를 DPR 2로 잡으면 매 프레임 4배 픽셀을 GPU에 올린다.
// 빠르게 움직이는 장식 레이어라 1.5로 캡해도 눈에 띄지 않는다.
const MAX_DPR = 1.5;
// 살아있는 파티클 상한. 저사양 기기에서는 아래 자동 스로틀이 더 줄인다.
const HARD_CAP = 240;

let ctx2d = null;
let dprScale = 1;
let parts = [];
let raf = 0;
let lastT = 0;
let emaFrame = 16.7;
let quality = 1;   // 자동 스로틀 계수 (0.35~1)

function deviceScale() {
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 4;
  if (cores <= 2 || mem <= 2) return 0.45;
  if (cores <= 4 || mem <= 4) return 0.7;
  return 1;
}
const BASE_SCALE = deviceScale();

function setup() {
  const cv = document.getElementById('fx');
  if (!cv) return null;
  dprScale = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  cv.width = Math.floor(window.innerWidth * dprScale);
  cv.height = Math.floor(window.innerHeight * dprScale);
  ctx2d = cv.getContext('2d');
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.setTransform(dprScale, 0, 0, dprScale, 0, 0);
  return ctx2d;
}

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (parts.length) setup(); }, 120);
});

function loop(now) {
  const c = ctx2d;
  if (!c) { raf = 0; return; }

  // dt 기반 물리 — 30fps에서도 120Hz에서도 같은 속도로 보인다
  const rawDt = lastT ? (now - lastT) / 1000 : 1 / 60;
  lastT = now;
  const dt = Math.min(rawDt, 1 / 30);

  emaFrame = emaFrame * 0.9 + (rawDt * 1000) * 0.1;
  // 프레임이 계속 밀리면 스스로 파티클을 덜어낸다
  if (emaFrame > 26 && quality > 0.35) {
    quality = Math.max(0.35, quality - 0.12);
    const keep = Math.max(24, Math.floor(parts.length * 0.7));
    if (parts.length > keep) parts.length = keep;
  } else if (emaFrame < 18 && quality < 1) {
    quality = Math.min(1, quality + 0.02);
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  c.setTransform(dprScale, 0, 0, dprScale, 0, 0);
  c.clearRect(0, 0, w, h);

  // 배열을 새로 만들지 않고 제자리에서 압축한다 (프레임당 GC 방지)
  let n = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    p.life -= dt;
    p.vy += p.g * dt * 60;
    p.x += p.vx * dt * 60;
    p.y += p.vy * dt * 60;
    p.rot += p.vrot * dt * 60;
    if (p.life <= 0 || p.y > h + 90) continue;
    parts[n++] = p;

    const k = p.size / SPRITE;
    const cos = Math.cos(p.rot) * k;
    const sin = Math.sin(p.rot) * k;
    c.globalAlpha = Math.max(0, Math.min(1, p.life / p.fade));
    // save/restore 대신 setTransform — 파티클당 상태 스택 비용을 없앤다
    c.setTransform(cos * dprScale, sin * dprScale, -sin * dprScale, cos * dprScale,
                   p.x * dprScale, p.y * dprScale);
    c.drawImage(p.sp, -SPRITE / 2, -SPRITE / 2);
  }
  parts.length = n;

  c.globalAlpha = 1;
  c.setTransform(dprScale, 0, 0, dprScale, 0, 0);

  if (n) {
    raf = requestAnimationFrame(loop);
  } else {
    c.clearRect(0, 0, w, h);
    raf = 0;
    lastT = 0;
  }
}

function start() {
  if (!ctx2d) setup();
  if (!raf) { lastT = 0; raf = requestAnimationFrame(loop); }
}

function budget(count) {
  const areaScale = Math.min(1, (window.innerWidth * window.innerHeight) / (1440 * 900));
  const wanted = Math.round(count * BASE_SCALE * quality * (0.55 + 0.45 * areaScale));
  const room = Math.max(0, HARD_CAP - parts.length);
  // 최소 12개는 보장하되, 상한을 넘기지는 않는다
  return Math.min(Math.max(wanted, 12), room);
}

/** origin을 주면 그 지점에서, 없으면 화면 상단 1/3 지점에서 분출한다 */
export function burst(emoji, rarity = 1, origin = null) {
  if (reducedMotion()) return;
  const ch = emoji || '✨';
  const sp = sprite(ch);
  const count = budget(rarity >= 3 ? 140 : rarity === 2 ? 90 : 60);
  if (count <= 0) return;
  const ox = origin ? origin.x : window.innerWidth / 2;
  const oy = origin ? origin.y : window.innerHeight * 0.34;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const speed = 8 + Math.random() * 13;
    parts.push({
      sp,
      x: ox + (Math.random() - 0.5) * 60,
      y: oy + (Math.random() - 0.5) * 40,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
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
  const sp = sprite(emoji || '✨');
  const n = budget(count);
  if (n <= 0) return;
  for (let i = 0; i < n; i++) {
    parts.push({
      sp,
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
  // .shaking에 will-change:transform을 걸어 애니메이션 시작 시 한 번만 레이어로
  // 승격시킨다. 그러지 않으면 3D 카드 서브트리가 매 프레임 재래스터화된다.
  const target = document.getElementById('app');
  if (!target) return;
  target.classList.remove('shaking');
  void target.offsetWidth;
  target.classList.add('shaking');
  target.addEventListener('animationend', () => target.classList.remove('shaking'), { once: true });
}
