# 무엇이든 물어보세요 (카드 뽑기 사이트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 문구를 미리 작성한 사람이 링크 하나를 공유하면, 받은 사람이 가챠 연출과 함께 카드를 뽑아 문구 하나를 무작위로 보는 단일 HTML 사이트를 만든다.

**Architecture:** `src/` 아래 책임별 ES 모듈로 개발하고, `build.mjs`가 CSS·JS를 HTML 템플릿에 인라인해 의존성 0인 `dist/index.html` 하나를 만든다. 순수 로직(codec, deck)은 `node --test`로 단위 테스트하고, DOM·연출은 빌드 산출물을 Playwright로 실제 구동해 검증한다.

**Tech Stack:** 바닐라 ES모듈 + CSS, Node 24 (`node --test`, `node --check`), Playwright MCP, Artifact 퍼블리시. 런타임 외부 의존성 0.

**Spec:** `docs/superpowers/specs/2026-09-01-ask-anything-card-design.md`

## Global Constraints

- 사이트명은 정확히 `무엇이든 물어보세요`. slug는 `ask-anything`.
- `dist/index.html`은 자기완결적이어야 한다: 외부 script/link/img/font/fetch 0개. CDN 금지, 사운드·이미지 파일 금지.
- 팔레트: 배경 `#131a3a`, 심층 `#0c1129`, 금색 `#e8c46a`, 금색 강조 `#f5dfa3`, 본문 `#e6e9f5`, 보조 텍스트 `#98a0c4`.
- 카드 장수는 `3 | 5 | 7`만 허용. 문구는 1~30개, 각 1~200자. 제목 1~40자, 질문 0~80자.
- 등급 `r`은 `1 | 2 | 3`, 추첨 가중치는 `{1: 6, 2: 3, 3: 1}`. 기본 등급 1, 기본 이모지 `✨`.
- 링크 payload는 `#d=` + 압축플래그 1글자(`1`=deflate-raw, `0`=원문) + base64url 본문.
- `prefers-reduced-motion: reduce`에서는 파티클·화면흔들림을 실행하지 않는다.
- 모든 `localStorage` 접근은 try/catch로 감싸고, 실패해도 화면이 정상 동작해야 한다.
- 소스 모듈은 `export function` / `export const`와 `import ... from './x.mjs'`만 사용한다(build.mjs의 인라인 규약).
- 커밋 메시지는 `feat:` / `test:` / `fix:` / `chore:` 접두사를 쓴다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/codec.mjs` | deck 객체 ↔ URL 해시 문자열. DOM 모름 |
| `src/deck.mjs` | deck 기본값·정규화·검증, 가중 랜덤 추첨. DOM 모름 |
| `src/fx.mjs` | 캔버스 이모지 파티클, 방사형 플래시, 화면 흔들림 |
| `src/sfx.mjs` | WebAudio 합성 효과음, 진동, 음소거 토글 |
| `src/builder.mjs` | 만들기 화면: 입력 폼·미리보기·링크 생성/복사 |
| `src/player.mjs` | 뽑기 화면 상태 기계: intro→shuffle→spread→focus→reveal→result |
| `src/main.mjs` | 해시 라우팅, 손상 링크 폴백 |
| `src/style.css` | 전체 스타일, 카드 3D, 반응형, 다크/라이트 고정 |
| `src/template.html` | `<!--CSS-->`, `<!--JS-->` 주입 마커를 가진 HTML 골격 |
| `build.mjs` | src 인라인 → `dist/index.html` 생성 + 문법 검사 |
| `test/codec.test.mjs` | codec 왕복·폴백·손상 입력 테스트 |
| `test/deck.test.mjs` | 정규화·검증·가중 추첨 테스트 |
| `test/build.test.mjs` | 빌드 산출물 자기완결성 테스트 |

의존 방향: `main → {builder, player}`, `player → {deck, fx, sfx}`, `builder → {codec, deck}`, `codec → (없음)`, `deck → (없음)`. 역방향 참조 금지.

---

### Task 0: 저장소·디렉터리 초기화

**Files:**
- Create: `.gitignore`
- Create: `package.json`

- [ ] **Step 1: git 저장소 초기화**

```bash
cd "C:/Users/MADUP/Desktop/클로드/15. 카드"
git init
git branch -M main
```

- [ ] **Step 2: `.gitignore` 작성**

```
node_modules/
.DS_Store
*.log
tmp/
```

- [ ] **Step 3: `package.json` 작성**

```json
{
  "name": "ask-anything",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "node build.mjs",
    "test": "node --test test/"
  }
}
```

- [ ] **Step 4: 첫 커밋**

```bash
git add .gitignore package.json docs
git commit -m "chore: init ask-anything project with spec and plan"
```

---

### Task 1: codec — 링크 인코딩/디코딩

**Files:**
- Create: `src/codec.mjs`
- Test: `test/codec.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `encode(deck: object) -> Promise<string>` — 압축플래그 포함 payload 문자열 반환 (`#d=` 접두사는 붙이지 않음)
  - `decode(payload: string) -> Promise<object>` — 실패 시 `throw new Error('BAD_PAYLOAD')`
  - `encode(deck, { compress: false }) -> Promise<string>` — 폴백 경로 강제 (테스트용)

- [ ] **Step 1: 실패하는 테스트 작성**

`test/codec.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { encode, decode } from '../src/codec.mjs';

const deck = {
  t: '올해 나의 여행운',
  q: '나를 여름 휴가지로 이끌어 줄 카드를 선택해주세요',
  n: 3,
  c: [
    { e: '🌊', m: '바다로 가세요.\n파도가 답을 줍니다.', r: 1 },
    { e: '⛰️', m: '산에서 쉬어가세요.', r: 3 },
  ],
};

test('압축 경로 왕복이 원본과 일치한다', async () => {
  const payload = await encode(deck);
  assert.equal(payload[0], '1');
  assert.deepEqual(await decode(payload), deck);
});

test('비압축 폴백 경로 왕복이 원본과 일치한다', async () => {
  const payload = await encode(deck, { compress: false });
  assert.equal(payload[0], '0');
  assert.deepEqual(await decode(payload), deck);
});

test('압축 payload가 비압축보다 짧다', async () => {
  const big = { ...deck, c: Array.from({ length: 12 }, () => ({ e: '✨', m: '반복되는 긴 문구입니다. 압축이 잘 되어야 합니다.', r: 1 })) };
  const zipped = await encode(big);
  const plain = await encode(big, { compress: false });
  assert.ok(zipped.length < plain.length, `${zipped.length} < ${plain.length}`);
});

test('payload에 base64url 금지문자가 없다', async () => {
  const payload = await encode(deck);
  assert.match(payload, /^[01][A-Za-z0-9_-]+$/);
});

test('손상된 payload는 BAD_PAYLOAD를 던진다', async () => {
  for (const bad of ['', 'zzzz', '1@@@@', '9abc', '1', '0!!!']) {
    await assert.rejects(() => decode(bad), /BAD_PAYLOAD/, `input: ${bad}`);
  }
});

test('압축 플래그가 없는 레거시 문자열도 BAD_PAYLOAD로 처리된다', async () => {
  await assert.rejects(() => decode('eyJ0IjoiYSJ9'), /BAD_PAYLOAD/);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test test/codec.test.mjs`
Expected: FAIL — `Cannot find module '../src/codec.mjs'`

- [ ] **Step 3: `src/codec.mjs` 구현**

```js
const FLAG_PLAIN = '0';
const FLAG_DEFLATE = '1';

function bytesToB64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = typeof btoa === 'function'
    ? btoa(bin)
    : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  if (typeof atob === 'function') {
    const bin = atob(b64 + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64 + pad, 'base64'));
}

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encode(deck, { compress = true } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(deck));
  if (compress && typeof CompressionStream === 'function') {
    try {
      const out = await pipe(bytes, new CompressionStream('deflate-raw'));
      return FLAG_DEFLATE + bytesToB64url(out);
    } catch { /* 폴백으로 진행 */ }
  }
  return FLAG_PLAIN + bytesToB64url(bytes);
}

export async function decode(payload) {
  try {
    if (typeof payload !== 'string' || payload.length < 2) throw new Error('short');
    const flag = payload[0];
    const body = payload.slice(1);
    if (!/^[A-Za-z0-9_-]+$/.test(body)) throw new Error('charset');
    let bytes = b64urlToBytes(body);
    if (flag === FLAG_DEFLATE) {
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (flag !== FLAG_PLAIN) {
      throw new Error('flag');
    }
    const deck = JSON.parse(new TextDecoder().decode(bytes));
    if (!deck || typeof deck !== 'object' || !Array.isArray(deck.c)) throw new Error('shape');
    return deck;
  } catch {
    throw new Error('BAD_PAYLOAD');
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/codec.test.mjs`
Expected: PASS — 6 tests

- [ ] **Step 5: 커밋**

```bash
git add src/codec.mjs test/codec.test.mjs
git commit -m "feat: add url payload codec with deflate and plain fallback"
```

---

### Task 2: deck — 모델·검증·가중 추첨

**Files:**
- Create: `src/deck.mjs`
- Test: `test/deck.test.mjs`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `const LIMITS = { title: 40, question: 80, message: 200, cards: 30 }`
  - `const WEIGHTS = { 1: 6, 2: 3, 3: 1 }`
  - `const CARD_COUNTS = [3, 5, 7]`
  - `emptyDeck() -> deck` — 문구 1개짜리 빈 데크
  - `normalize(raw) -> deck` — 잘못된 값을 제약 안으로 잘라내고 기본값 채움. 유효 문구 0개면 `emptyDeck()` 반환
  - `validate(deck) -> string[]` — 사람이 읽는 오류 메시지 배열. 빈 배열이면 유효
  - `pickIndex(deck, rnd = Math.random) -> number` — 가중 랜덤으로 `deck.c`의 인덱스 하나 반환

- [ ] **Step 1: 실패하는 테스트 작성**

`test/deck.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDeck, normalize, validate, pickIndex, LIMITS, CARD_COUNTS } from '../src/deck.mjs';

test('emptyDeck은 검증을 통과하지 못한다(문구 미입력)', () => {
  const errs = validate(emptyDeck());
  assert.ok(errs.length > 0);
});

test('normalize는 기본 이모지와 등급을 채운다', () => {
  const d = normalize({ c: [{ m: '안녕' }] });
  assert.equal(d.c[0].e, '✨');
  assert.equal(d.c[0].r, 1);
  assert.equal(d.t, '무엇이든 물어보세요');
});

test('normalize는 카드 장수를 허용값으로 보정한다', () => {
  assert.ok(CARD_COUNTS.includes(normalize({ n: 4, c: [{ m: 'a' }] }).n));
  assert.ok(CARD_COUNTS.includes(normalize({ n: 99, c: [{ m: 'a' }] }).n));
});

test('normalize는 길이 제약을 넘는 값을 잘라낸다', () => {
  const d = normalize({ t: 'ㄱ'.repeat(100), q: 'ㄴ'.repeat(200), c: [{ m: 'ㄷ'.repeat(500) }] });
  assert.equal(d.t.length, LIMITS.title);
  assert.equal(d.q.length, LIMITS.question);
  assert.equal(d.c[0].m.length, LIMITS.message);
});

test('normalize는 문구 개수를 30개로 제한한다', () => {
  const d = normalize({ c: Array.from({ length: 50 }, (_, i) => ({ m: `문구${i}` })) });
  assert.equal(d.c.length, LIMITS.cards);
});

test('normalize는 빈 문구를 버리고, 전부 비면 emptyDeck을 준다', () => {
  const d = normalize({ c: [{ m: '  ' }, { m: '' }] });
  assert.deepEqual(d.c, emptyDeck().c);
});

test('normalize는 등급을 1~3으로 보정한다', () => {
  const d = normalize({ c: [{ m: 'a', r: 0 }, { m: 'b', r: 9 }, { m: 'c', r: 2 }] });
  assert.deepEqual(d.c.map((x) => x.r), [1, 3, 2]);
});

test('validate는 유효한 데크에 빈 배열을 준다', () => {
  assert.deepEqual(validate(normalize({ t: '제목', c: [{ m: '문구' }] })), []);
});

test('pickIndex는 항상 유효한 인덱스를 준다', () => {
  const d = normalize({ c: [{ m: 'a' }, { m: 'b' }, { m: 'c' }] });
  for (let i = 0; i < 200; i++) {
    const idx = pickIndex(d);
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < 3);
  }
});

test('pickIndex는 문구가 1개면 항상 0을 준다', () => {
  const d = normalize({ c: [{ m: 'only' }] });
  assert.equal(pickIndex(d, () => 0.999), 0);
});

test('등급이 높은 문구가 더 드물게 뽑힌다', () => {
  const d = normalize({ c: [{ m: 'common', r: 1 }, { m: 'rare', r: 3 }] });
  let rare = 0;
  for (let i = 0; i < 6000; i++) if (pickIndex(d) === 1) rare++;
  // 기대 비율 1/7 ≈ 0.143 → 넉넉한 구간으로 검증
  assert.ok(rare / 6000 > 0.08 && rare / 6000 < 0.22, `ratio=${rare / 6000}`);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test test/deck.test.mjs`
Expected: FAIL — `Cannot find module '../src/deck.mjs'`

- [ ] **Step 3: `src/deck.mjs` 구현**

```js
export const LIMITS = { title: 40, question: 80, message: 200, cards: 30 };
export const WEIGHTS = { 1: 6, 2: 3, 3: 1 };
export const CARD_COUNTS = [3, 5, 7];
export const DEFAULT_TITLE = '무엇이든 물어보세요';
export const DEFAULT_EMOJI = '✨';

const clampText = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function emptyDeck() {
  return { t: DEFAULT_TITLE, q: '', n: 3, c: [{ e: DEFAULT_EMOJI, m: '', r: 1 }] };
}

export function normalize(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const cards = (Array.isArray(src.c) ? src.c : [])
    .map((x) => (x && typeof x === 'object' ? x : {}))
    .map((x) => ({
      e: clampText(x.e, 8) || DEFAULT_EMOJI,
      m: typeof x.m === 'string' ? x.m.trim().slice(0, LIMITS.message) : '',
      r: [1, 2, 3].includes(Number(x.r)) ? Number(x.r) : (Number(x.r) > 3 ? 3 : 1),
    }))
    .filter((x) => x.m.length > 0)
    .slice(0, LIMITS.cards);

  return {
    t: clampText(src.t, LIMITS.title) || DEFAULT_TITLE,
    q: clampText(src.q, LIMITS.question),
    n: CARD_COUNTS.includes(Number(src.n)) ? Number(src.n) : 3,
    c: cards.length ? cards : emptyDeck().c,
  };
}

export function validate(deck) {
  const errs = [];
  const cards = Array.isArray(deck?.c) ? deck.c : [];
  const filled = cards.filter((x) => typeof x?.m === 'string' && x.m.trim().length > 0);
  if (filled.length === 0) errs.push('문구를 최소 1개 입력해주세요.');
  if (filled.length > LIMITS.cards) errs.push(`문구는 최대 ${LIMITS.cards}개까지 넣을 수 있어요.`);
  if (typeof deck?.t === 'string' && deck.t.length > LIMITS.title) errs.push(`제목은 ${LIMITS.title}자까지 가능해요.`);
  if (typeof deck?.q === 'string' && deck.q.length > LIMITS.question) errs.push(`질문은 ${LIMITS.question}자까지 가능해요.`);
  if (cards.some((x) => typeof x?.m === 'string' && x.m.length > LIMITS.message)) {
    errs.push(`문구 하나는 ${LIMITS.message}자까지 가능해요.`);
  }
  return errs;
}

export function pickIndex(deck, rnd = Math.random) {
  const cards = deck.c;
  const weights = cards.map((x) => WEIGHTS[x.r] ?? WEIGHTS[1]);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rnd() * total;
  for (let i = 0; i < cards.length; i++) {
    roll -= weights[i];
    if (roll < 0) return i;
  }
  return cards.length - 1;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/deck.test.mjs`
Expected: PASS — 11 tests

- [ ] **Step 5: 커밋**

```bash
git add src/deck.mjs test/deck.test.mjs
git commit -m "feat: add deck model with normalization and weighted draw"
```

---

### Task 3: build — 단일 HTML 산출

**Files:**
- Create: `src/template.html`
- Create: `src/style.css` (이 태스크에서는 팔레트 변수 + body 기본만)
- Create: `src/main.mjs` (이 태스크에서는 라우팅 골격만)
- Create: `build.mjs`
- Test: `test/build.test.mjs`

**Interfaces:**
- Consumes: `src/codec.mjs`의 `decode`, `src/deck.mjs`의 `normalize`
- Produces:
  - `dist/index.html` — 외부 의존성 0인 단일 파일
  - `main.mjs`가 export하는 것 없음 (엔트리). `#app` 안에 화면을 그린다.
  - build 규약: `src/*.mjs`에서 `^import .*\n` 제거, `^export ` 제거 후 의존 순서로 연결

- [ ] **Step 1: 실패하는 테스트 작성**

`test/build.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

test('빌드가 dist/index.html을 만든다', () => {
  execFileSync(process.execPath, ['build.mjs'], { stdio: 'pipe' });
  assert.ok(existsSync('dist/index.html'));
});

test('산출물에 외부 리소스 참조가 없다', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  assert.doesNotMatch(html, /src\s*=\s*["']https?:/i);
  assert.doesNotMatch(html, /href\s*=\s*["']https?:/i);
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i);
  assert.doesNotMatch(html, /cdnjs|jsdelivr|unpkg|fonts\.googleapis/i);
});

test('주입 마커가 남아있지 않다', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  assert.doesNotMatch(html, /<!--CSS-->|<!--JS-->/);
});

test('산출물에 import/export 잔재가 없다', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  assert.doesNotMatch(html, /^\s*import\s+.*from\s+/m);
  assert.doesNotMatch(html, /^\s*export\s+/m);
});

test('제목과 사이트명이 들어있다', () => {
  const html = readFileSync('dist/index.html', 'utf8');
  assert.match(html, /<title>무엇이든 물어보세요<\/title>/);
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `node --test test/build.test.mjs`
Expected: FAIL — `Cannot find module ... build.mjs`

- [ ] **Step 3: `src/template.html` 작성**

```html
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>무엇이든 물어보세요</title>
<style>
<!--CSS-->
</style>
</head>
<body>
<main id="app"></main>
<canvas id="fx" aria-hidden="true"></canvas>
<script type="module">
<!--JS-->
</script>
</body>
</html>
```

- [ ] **Step 4: `src/style.css` 초기 작성**

```css
:root{
  --bg:#131a3a; --deep:#0c1129; --gold:#e8c46a; --gold-hi:#f5dfa3;
  --ink:#e6e9f5; --muted:#98a0c4; --line:rgba(232,196,106,.28);
  color-scheme: dark;
}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{
  background:
    radial-gradient(120% 80% at 50% -10%, #24306a 0%, transparent 60%),
    var(--bg);
  color:var(--ink);
  font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
}
#app{max-width:960px;margin:0 auto;padding:28px 18px 60px}
#fx{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50}
```

- [ ] **Step 5: `src/main.mjs` 라우팅 골격 작성**

```js
import { decode } from './codec.mjs';
import { normalize } from './deck.mjs';

const root = document.getElementById('app');

function readPayload() {
  const m = /^#d=(.+)$/.exec(location.hash);
  return m ? m[1] : null;
}

async function route() {
  const payload = readPayload();
  if (!payload) {
    mountBuilder(root, null, null);
    return;
  }
  try {
    const deck = normalize(await decode(payload));
    mountPlayer(root, deck);
  } catch {
    mountBuilder(root, null, '링크가 손상된 것 같아요. 문구를 새로 만들어 공유해보세요.');
  }
}

window.addEventListener('hashchange', route);
route();
```

Task 3 시점에는 `mountBuilder` / `mountPlayer`가 아직 없다. 이 태스크에서는
`src/main.mjs` 아래에 임시 스텁 두 개를 함께 두고, Task 4·5에서 각 모듈로
옮기며 스텁을 삭제한다.

```js
// TEMP: Task 4에서 builder.mjs로 대체, Task 5에서 player.mjs로 대체
function mountBuilder(el, deck, notice) {
  el.innerHTML = `<h1>무엇이든 물어보세요</h1><p>${notice ?? '만들기 화면 준비 중'}</p>`;
}
function mountPlayer(el, deck) {
  el.innerHTML = `<h1>${deck.t}</h1><p>뽑기 화면 준비 중 (문구 ${deck.c.length}개)</p>`;
}
```

- [ ] **Step 6: `build.mjs` 작성**

```js
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// 의존 순서: 의존 대상이 먼저 온다
const MODULES = ['codec.mjs', 'deck.mjs', 'fx.mjs', 'sfx.mjs', 'builder.mjs', 'player.mjs', 'main.mjs'];

const read = (p) => readFileSync(new URL(`./src/${p}`, import.meta.url), 'utf8');
const exists = (p) => { try { read(p); return true; } catch { return false; } };

const strip = (code) => code
  .replace(/^\s*import\s+[^;]*;\s*$/gm, '')   // import 문 제거
  .replace(/^export\s+/gm, '')                 // export 키워드 제거
  .trim();

const js = MODULES.filter(exists).map((m) => `/* ${m} */\n${strip(read(m))}`).join('\n\n');
const css = read('style.css').trim();

const html = read('template.html')
  .replace('<!--CSS-->', () => css)
  .replace('<!--JS-->', () => js);

mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/index.html', import.meta.url), html, 'utf8');

// 문법 검사: 합쳐진 JS를 임시 모듈로 저장해 node --check
const tmp = new URL('./dist/.bundle-check.mjs', import.meta.url);
writeFileSync(tmp, js, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tmp.pathname.replace(/^\//, '')], { stdio: 'pipe' });
} catch (e) {
  console.error('번들 문법 오류:\n' + (e.stderr?.toString() ?? e.message));
  process.exit(1);
} finally {
  rmSync(tmp, { force: true });
}

const kb = (html.length / 1024).toFixed(1);
console.log(`dist/index.html 생성 완료 (${kb} KB, 모듈 ${MODULES.filter(exists).length}개)`);
```

- [ ] **Step 7: 빌드 실행 후 테스트 통과 확인**

Run: `node build.mjs && node --test test/build.test.mjs`
Expected: 빌드 성공 로그 + PASS 5 tests

- [ ] **Step 8: 브라우저에서 골격 확인**

Playwright로 `file:///C:/Users/MADUP/Desktop/클로드/15. 카드/dist/index.html` 열기.
Expected: 콘솔 에러 0개, "무엇이든 물어보세요" 제목 표시.
그 다음 `#d=zzzz`를 붙여 다시 열기 → 손상 링크 안내 문구 표시.

- [ ] **Step 9: 커밋**

```bash
git add build.mjs src/template.html src/style.css src/main.mjs test/build.test.mjs dist/index.html
git commit -m "feat: add single-file build pipeline and hash routing"
```

---

### Task 4: builder — 만들기 화면

**Files:**
- Create: `src/builder.mjs`
- Modify: `src/main.mjs` (임시 `mountBuilder` 스텁 삭제, `import { mountBuilder } from './builder.mjs'` 추가)
- Modify: `src/style.css` (builder 스타일 추가)

**Interfaces:**
- Consumes: `encode` (codec), `emptyDeck` / `normalize` / `validate` / `LIMITS` / `CARD_COUNTS` / `DEFAULT_EMOJI` (deck)
- Produces: `mountBuilder(root: HTMLElement, initialDeck: object|null, notice: string|null) -> void`

- [ ] **Step 1: 화면 구조를 마크업으로 확정**

`mountBuilder`가 그리는 DOM. 아래 `data-testid`는 Task 7 검증에서 그대로 쓰이므로 이름을 바꾸지 않는다.

| 요소 | testid | 비고 |
|---|---|---|
| 제목 입력 | `b-title` | `maxlength=40`, placeholder `무엇이든 물어보세요` |
| 질문 입력 | `b-question` | `maxlength=80`, placeholder `궁금한 걸 떠올리고 카드를 뽑으세요` |
| 카드 장수 라디오 | `b-count-3` / `b-count-5` / `b-count-7` | 기본 3 선택 |
| 문구 행 컨테이너 | `b-rows` | 행마다 `.row` |
| 행: 이모지 | `b-emoji-<i>` | `maxlength=8`, 빈값이면 `✨` |
| 행: 문구 | `b-message-<i>` | `<textarea>`, `maxlength=200` |
| 행: 등급 | `b-rarity-<i>` | `<select>` 옵션 `★ 흔함(1) / ★★ 조금 귀함(2) / ★★★ 매우 귀함(3)` |
| 행: 삭제 | `b-remove-<i>` | 문구가 1개일 때는 `disabled` |
| 문구 추가 | `b-add` | 30개 도달 시 `disabled` |
| 미리보기 | `b-preview` | 카드 뒷면 n장 + 제목/질문 |
| 링크 만들기 | `b-make` | 클릭 시 링크 생성 |
| 링크 출력 | `b-link` | `readonly` input |
| 복사 | `b-copy` | 성공 시 버튼 텍스트 `복사됨!` 1.5초 |
| 테스트 | `b-try` | 생성된 링크로 이동 |
| 오류 영역 | `b-errors` | `validate()` 결과를 `<li>`로 |

- [ ] **Step 2: 상태 관리 방식 확정**

모듈 로컬 `let deck`을 두고, 입력 이벤트마다 `deck`을 갱신 → `renderPreview()`만
다시 그린다. 입력 중 전체 재렌더는 포커스를 잃게 하므로 금지한다.
행 추가/삭제 시에만 `renderRows()`로 행 영역을 다시 그리고, 직후
새로 추가된 행의 `b-message-<i>`에 포커스를 준다.

- [ ] **Step 3: 링크 생성 로직 구현**

```js
async function makeLink() {
  const errs = validate(deck);
  renderErrors(errs);
  if (errs.length) return null;
  const payload = await encode(normalize(deck));
  const url = location.origin === 'null'
    ? `${location.pathname}#d=${payload}`      // file:// 로 열었을 때
    : `${location.origin}${location.pathname}#d=${payload}`;
  linkInput.value = url;
  linkBox.hidden = false;
  return url;
}
```

복사는 `navigator.clipboard.writeText` 우선, 실패하면
`linkInput.select(); document.execCommand('copy')` 폴백. 둘 다 실패하면
"직접 복사해주세요" 안내를 띄우고 input을 선택 상태로 둔다.

- [ ] **Step 4: 개인정보 안내 한 줄 추가**

`b-make` 버튼 아래에 회색 작은 글씨로 정확히 이 문장을 넣는다:
`문구는 서버에 저장되지 않고 링크 안에 담깁니다. 링크를 가진 사람은 모든 문구를 볼 수 있으니 기밀 내용은 넣지 마세요.`

- [ ] **Step 5: `src/main.mjs`에서 스텁 제거**

`function mountBuilder(...)` 임시 정의를 삭제하고 파일 상단에
`import { mountBuilder } from './builder.mjs';`를 추가한다.
`build.mjs`의 `MODULES` 순서에 `builder.mjs`가 `main.mjs`보다 앞에 있는지 확인한다(이미 그렇게 정의되어 있다).

- [ ] **Step 6: 빌드 + 브라우저 검증**

Run: `node build.mjs && node --test test/`
그다음 Playwright로 `dist/index.html`을 열고:
1. `b-message-0`에 `바다로 가세요` 입력
2. `b-add` 클릭 → `b-message-1`에 `산으로 가세요` 입력
3. `b-count-5` 선택 → 미리보기 카드가 5장인지 확인
4. `b-make` 클릭 → `b-link` 값이 `#d=1`을 포함하는지 확인
5. 스크린샷 저장
Expected: 콘솔 에러 0개, 링크 정상 생성

- [ ] **Step 7: 커밋**

```bash
git add src/builder.mjs src/main.mjs src/style.css dist/index.html
git commit -m "feat: add builder screen with live preview and share link"
```

---

### Task 5: player — 뽑기 화면 상태 기계

**Files:**
- Create: `src/player.mjs`
- Modify: `src/main.mjs` (임시 `mountPlayer` 스텁 삭제, import 추가)
- Modify: `src/style.css` (카드 3D·연출 스타일 추가)

**Interfaces:**
- Consumes: `pickIndex` (deck), `burst` / `flash` / `shake` (fx), `sfxPlay` / `sfxSetEnabled` / `sfxEnabled` (sfx)
- Produces: `mountPlayer(root: HTMLElement, deck: object) -> void`

fx·sfx는 Task 6에서 구현한다. Task 5에서는 `src/fx.mjs`·`src/sfx.mjs`에
아래 시그니처의 no-op 함수를 먼저 만들어 두고(연출 없이 흐름만 동작),
Task 6에서 내용을 채운다.

```js
// src/fx.mjs (Task 5: no-op)
export function burst(emoji, rarity) {}
export function flash() {}
export function shake() {}
// src/sfx.mjs (Task 5: no-op)
export function sfxPlay(name) {}
export function sfxSetEnabled(on) {}
export function sfxEnabled() { return true; }
```

- [ ] **Step 1: 상태 기계 구현**

```js
const STATES = ['intro', 'shuffle', 'spread', 'focus', 'reveal', 'result'];
let state = 'intro';
let chosenIdx = null;   // 화면상 몇 번째 카드를 눌렀는지
let resultIdx = null;   // deck.c의 어느 문구가 나왔는지
```

전이 규칙(스펙 7절과 동일):
`intro --섞기--> shuffle --700ms--> spread --카드클릭--> focus --450ms--> reveal --700ms--> result --한번더--> shuffle`

각 전이는 `setTimeout`이 아니라 `transitionend` 또는 명시적 `await wait(ms)`
헬퍼로 처리하고, 전이 중에는 카드 클릭을 무시한다(`state !== 'spread'`면 return).

- [ ] **Step 2: 화면 요소와 testid 확정**

| 요소 | testid |
|---|---|
| 제목 | `p-title` |
| 질문 | `p-question` |
| 섞기 버튼 | `p-shuffle` |
| 카드 컨테이너 | `p-cards` |
| 카드 n번째 | `p-card-<i>` (`<button>`) |
| 결과 문구 | `p-result-message` |
| 결과 이모지 | `p-result-emoji` |
| 등급 표시 | `p-result-rarity` |
| 한 번 더 | `p-again` |
| 링크 복사 | `p-copy` |
| 나도 만들기 | `p-create` |
| 사운드 토글 | `p-sound` |

- [ ] **Step 3: 카드 렌더링**

`deck.n`장을 만든다. 각 카드는 `<button class="card" data-testid="p-card-i">`이며
앞면(`.card-front`)·뒷면(`.card-back`)을 가진 3D 플립 구조:

```css
.card{width:132px;height:206px;perspective:900px;background:none;border:0;padding:0;cursor:pointer}
.card-inner{position:relative;width:100%;height:100%;transform-style:preserve-3d;
  transition:transform .7s cubic-bezier(.2,.7,.2,1)}
.card.revealed .card-inner{transform:rotateY(180deg)}
.card-front,.card-back{position:absolute;inset:0;backface-visibility:hidden;
  border-radius:12px;border:1px solid var(--line);display:grid;place-items:center}
.card-back{background:linear-gradient(160deg,#1b2350,#0f1533);color:var(--gold)}
.card-front{background:linear-gradient(160deg,#f3efe2,#e7e0cc);color:#2b2b3a;transform:rotateY(180deg)}
```

카드 뒷면에는 카드 번호와 달·별 글리프(`☾` `✦`)를 CSS로만 넣는다(이미지 금지).

- [ ] **Step 4: 결과 배정**

카드 클릭 시 `resultIdx = pickIndex(deck)`로 뽑는다. 어떤 카드를 눌러도
문구는 랜덤이라는 스펙을 지킨다. `reveal` 진입 시 선택 카드의 앞면에
`deck.c[resultIdx]`의 이모지와 문구를 채운 뒤 `.revealed`를 붙인다.

- [ ] **Step 5: 결과 문구 타이핑 등장**

`result` 진입 시 `p-result-message`에 문구를 30ms/글자로 채운다.
`prefers-reduced-motion`이면 타이핑 없이 즉시 전체 표시.

- [ ] **Step 6: 결과 액션 3개 연결**

- `p-again`: `state = 'shuffle'`로 되돌리고 카드 `.revealed` 제거 후 재셔플
- `p-copy`: 현재 `location.href`를 클립보드로 (Task 4의 복사 폴백 로직 재사용 — `builder.mjs`에서 `export function copyText(text): Promise<boolean>`로 빼내 공용화)
- `p-create`: `location.hash = ''` 후 `location.reload()`

- [ ] **Step 7: 사운드 토글**

우상단 고정 버튼. `localStorage.getItem('aa-sound')`가 `'off'`면 꺼진 상태로
시작한다. 읽기·쓰기 모두 try/catch.

- [ ] **Step 8: 빌드 + 브라우저 검증**

Run: `node build.mjs && node --test test/`
Playwright로 Task 4에서 만든 링크를 열고:
1. `p-shuffle` 클릭 → 카드 3장이 펼쳐지는지
2. `p-card-1` 클릭 → `p-result-message`에 문구가 나오는지
3. `p-again` 5회 클릭 → 매번 문구가 나오고 콘솔 에러 0개인지
4. 스크린샷 저장
Expected: 전 과정 콘솔 에러 0개

- [ ] **Step 9: 커밋**

```bash
git add src/player.mjs src/fx.mjs src/sfx.mjs src/main.mjs src/style.css dist/index.html
git commit -m "feat: add card draw player with 3d flip state machine"
```

---

### Task 6: fx·sfx — 가챠 연출

**Files:**
- Modify: `src/fx.mjs` (no-op → 실제 구현)
- Modify: `src/sfx.mjs` (no-op → 실제 구현)
- Modify: `src/style.css` (플래시·홀로그램·흔들림 키프레임)

**Interfaces:**
- Consumes: 없음 (DOM·WebAudio 직접 사용)
- Produces: Task 5에서 정의한 시그니처를 그대로 유지 —
  `burst(emoji: string, rarity: number)`, `flash()`, `shake()`,
  `sfxPlay(name: 'shuffle'|'pick'|'reveal'|'jackpot')`, `sfxSetEnabled(on)`, `sfxEnabled()`

- [ ] **Step 1: reduced-motion 가드 먼저 넣기**

```js
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
```
`burst` / `shake`는 `reduced()`면 즉시 return한다. `flash`는 0.15초 페이드로 대체.

- [ ] **Step 2: 파티클 구현**

`#fx` 캔버스에 그린다. 등급별 개수 60 / 90 / 140.
파티클 1개: `{x, y, vx, vy, size, rot, vrot, life}`. 화면 중앙 하단에서
위쪽 부채꼴로 분출, 중력 `0.12`, 수명 1.6초, 알파는 수명 비례로 감소.
`ctx.font = size + 'px serif'`로 이모지를 `fillText`한다.
DPR 대응: `canvas.width = innerWidth * devicePixelRatio`, `ctx.scale(dpr, dpr)`.
`resize` 이벤트에 재설정. 파티클이 0개가 되면 rAF 루프를 멈춘다(상시 루프 금지).

- [ ] **Step 3: 플래시·흔들림 구현**

`flash()`: `<div class="fx-flash">`를 body에 추가하고 애니메이션 종료 시 제거.
```css
.fx-flash{position:fixed;inset:0;z-index:60;pointer-events:none;
  background:radial-gradient(circle at 50% 45%,rgba(245,223,163,.85),transparent 55%);
  animation:fxflash .5s ease-out forwards}
@keyframes fxflash{0%{opacity:0;transform:scale(.6)}25%{opacity:1}100%{opacity:0;transform:scale(1.6)}}
@keyframes fxshake{0%,100%{transform:translate(0,0)}20%{transform:translate(-7px,3px)}
  40%{transform:translate(6px,-4px)}60%{transform:translate(-4px,-2px)}80%{transform:translate(3px,4px)}}
.shaking{animation:fxshake .45s ease-in-out}
```
`shake()`는 `#app`에 `.shaking`을 붙이고 `animationend`에 제거한다.

- [ ] **Step 4: ★3 전용 연출**

`rarity === 3`이면 추가로:
- 결과 카드에 `.holo` 클래스 → 무지개 그라디언트가 흐르는 오버레이 (`background-size:300% 300%` + `animation`)
- `shake()` 호출
- 이모지 비: 화면 상단에서 아래로 떨어지는 파티클 40개를 2.2초간 추가

- [ ] **Step 5: WebAudio 효과음 구현**

`AudioContext`는 최초 사용자 클릭 시 lazy 생성한다(자동재생 정책).

| name | 소리 |
|---|---|
| `shuffle` | 화이트노이즈 버퍼 0.18초 + 밴드패스 1200Hz |
| `pick` | 사인파 660Hz → 880Hz, 0.12초 |
| `reveal` | 삼각파 440Hz → 1320Hz 상승, 0.35초 |
| `jackpot` | 사인파 3개 화음(523/659/784Hz) 0.6초 + 감쇠 |

모든 소리는 `GainNode`로 0.18 이하로 제한하고 `exponentialRampToValueAtTime`으로
꼬리를 없애 클릭 노이즈를 막는다. `sfxEnabled()`가 false면 즉시 return.

- [ ] **Step 6: 진동**

`reveal` 순간 `navigator.vibrate?.(rarity === 3 ? [40, 60, 90] : 30)`.
`navigator.vibrate`가 없으면 아무 것도 하지 않는다(옵셔널 체이닝으로 충분).

- [ ] **Step 7: player.mjs에 호출 지점 연결**

| 시점 | 호출 |
|---|---|
| `p-shuffle` 클릭 | `sfxPlay('shuffle')` |
| 카드 클릭 | `sfxPlay('pick')` |
| `reveal` 진입 | `flash()`, `sfxPlay('reveal')`, 진동 |
| `result` 진입 | `burst(emoji, rarity)`, rarity 3이면 `shake()` + `sfxPlay('jackpot')` |

- [ ] **Step 8: 빌드 + 브라우저 검증**

Run: `node build.mjs && node --test test/`
Playwright로 ★3 문구가 포함된 링크를 열고 뽑기를 반복해 ★3 결과 화면
스크린샷을 확보한다. 콘솔 에러 0개, 파티클 캔버스가 결과 후 3초 내 비는지 확인.

- [ ] **Step 9: 커밋**

```bash
git add src/fx.mjs src/sfx.mjs src/player.mjs src/style.css dist/index.html
git commit -m "feat: add gacha particles, flash, shake and synth sfx"
```

---

### Task 7: 스펙 10절 검증 6항목 + 반응형·접근성

**Files:**
- Modify: `src/style.css` (모바일 카드 배치, 포커스 링)
- Modify: `test/codec.test.mjs` (긴 문구·줄바꿈 케이스 추가)
- Create: `docs/verification-2026-09-01.md`

**Interfaces:**
- Consumes: 전 태스크 산출물
- Produces: 검증 결과 기록 문서 + 스크린샷 경로 목록

- [ ] **Step 1: 링크 왕복 (검증 1)**

Run: `node --test test/`
Expected: 전체 PASS. 실패 시 해당 태스크로 돌아간다.

- [ ] **Step 2: 긴 문구·줄바꿈·이모지 (검증 2)**

`test/codec.test.mjs`에 추가:

```js
test('200자 문구와 줄바꿈, 이모지가 왕복에서 보존된다', async () => {
  const long = 'ㄱ'.repeat(90) + '\n' + '나다라'.repeat(30);
  const d = { t: '테스트 🎴', q: '질문 ✨', n: 7, c: [{ e: '🔥', m: long.slice(0, 200), r: 3 }] };
  assert.deepEqual(await decode(await encode(d)), d);
});
```
그리고 Playwright로 실제 200자 문구를 입력해 결과 화면에서 줄바꿈이 유지되고
카드 밖으로 넘치지 않는지 확인한다(문구는 카드 아래 결과 영역에 표시).

- [ ] **Step 3: 문구 1개 (검증 3)**

Playwright: 문구 1개만 넣고 링크 생성 → 뽑기 → `p-again` 3회.
Expected: 매번 그 문구가 나오고 에러 없음.

- [ ] **Step 4: 모바일 375px (검증 4)**

`browser_resize`로 375×760 설정 후 Builder·Player 양쪽 스크린샷.
카드 7장일 때 2줄로 배치되는지 확인. 필요한 CSS:

```css
#p-cards{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
@media (max-width:420px){
  .card{width:96px;height:150px}
  #app{padding:18px 14px 48px}
}
```
Expected: 가로 스크롤 없음(`document.documentElement.scrollWidth <= 375`).

- [ ] **Step 5: 손상 해시 폴백 (검증 5)**

Playwright로 `dist/index.html#d=zzzz` 열기.
Expected: Builder 화면 + `링크가 손상된 것 같아요` 안내 표시, 콘솔 에러 0개.

- [ ] **Step 6: 압축 미지원 폴백 (검증 6)**

`browser_evaluate`로 페이지 로드 전 `window.CompressionStream = undefined`를 만들 수는
없으므로, 대신 Task 1의 `encode(deck, {compress:false})` 노드 테스트로 인코딩을
검증하고, 브라우저에서는 `0`으로 시작하는 payload 링크를 직접 만들어 열어
정상 디코딩되는지 확인한다.

```bash
node -e "import('./src/codec.mjs').then(async m => console.log(await m.encode({t:'폴백',q:'',n:3,c:[{e:'✨',m:'비압축 링크 테스트',r:1}]},{compress:false})))"
```
출력된 payload를 `dist/index.html#d=<payload>`로 열어 뽑기가 되는지 확인한다.

- [ ] **Step 7: 접근성 — 키보드 조작**

카드가 `<button>`이므로 Tab 이동이 되어야 한다. 포커스 링을 명시한다:

```css
:where(button,input,textarea,select):focus-visible{
  outline:2px solid var(--gold-hi);outline-offset:3px}
```
Playwright: Tab 3회 → Enter로 카드 선택이 되는지 확인.

- [ ] **Step 8: 검증 문서 작성**

`docs/verification-2026-09-01.md`에 6개 항목 각각의
실행 명령 / 실제 출력 / 스크린샷 경로 / 판정(통과·실패)을 표로 기록한다.
추정이 아니라 실제 실행 결과만 적는다.

- [ ] **Step 9: 커밋**

```bash
git add src/style.css test/codec.test.mjs docs/verification-2026-09-01.md dist/index.html
git commit -m "test: verify all six spec checks with responsive and a11y fixes"
```

---

### Task 8: Artifact 퍼블리시

**Files:**
- Modify: `dist/index.html` (최종 빌드)

**Interfaces:**
- Consumes: `dist/index.html`
- Produces: 공유 가능한 Artifact URL

- [ ] **Step 1: 최종 빌드와 전체 테스트**

Run: `node build.mjs && node --test test/`
Expected: 빌드 성공 + 전체 PASS

- [ ] **Step 2: 산출물 자기완결성 최종 확인**

Run: `node -e "const h=require('fs').readFileSync('dist/index.html','utf8');console.log('외부참조:', /https?:\/\//.test(h));console.log('크기KB:', (h.length/1024).toFixed(1))"`
Expected: `외부참조: false`

- [ ] **Step 3: artifact-design 스킬 로드**

Artifact 퍼블리시 전 `artifact-design` 스킬을 반드시 읽는다.

- [ ] **Step 4: 퍼블리시용 파일 준비**

Artifact는 `<!doctype html>`·`<html>`·`<head>`·`<body>` 태그 없이
페이지 내용만 받는다. `dist/artifact.html`을 만들어
`<title>` + `<style>` + `<main>` + `<canvas>` + `<script type="module">`만 담는다.
`build.mjs`에 이 두 번째 산출물 생성을 추가한다.

- [ ] **Step 5: 퍼블리시**

`Artifact` 도구로 `dist/artifact.html`을 퍼블리시한다.
- title: `무엇이든 물어보세요`
- favicon: `🎴`
- description: 문구를 미리 써두고 링크를 공유하면, 받은 사람이 카드를 뽑아 문구 하나를 무작위로 보는 사이트

- [ ] **Step 6: 퍼블리시된 URL로 실제 검증**

Playwright로 Artifact URL을 열어 Builder에서 링크를 만들고, 그 링크를
새 탭에서 열어 뽑기까지 되는지 확인한다(해시 라우팅이 실제 호스팅에서
동작하는지가 핵심). 스크린샷 확보.

- [ ] **Step 7: 커밋**

```bash
git add build.mjs dist
git commit -m "chore: publish ask-anything artifact build"
```

---

## Self-Review

**1. Spec coverage**

| 스펙 절 | 담당 태스크 |
|---|---|
| 3 아키텍처 / 3.1 모듈 경계 | Task 3 (라우팅·빌드), 전 태스크의 파일 분리 |
| 4 데이터 모델 / 4.1 가중치 | Task 2 |
| 5 링크 인코딩 (플래그·폴백·base64url) | Task 1 |
| 6 Builder 화면 | Task 4 |
| 7 Player 상태 기계 | Task 5 |
| 8 이펙트·사운드 (reduced-motion 포함) | Task 6 |
| 9 반응형·접근성 | Task 7 Step 4·7 |
| 10 검증 6항목 | Task 7 |
| 11 범위 밖 | 어떤 태스크에도 없음 (의도된 것) |
| 12 산출물 | Task 8 |

빠진 요구사항 없음.

**2. Placeholder scan**

Task 3 Step 5의 `mountBuilder`/`mountPlayer` 스텁과 Task 5의 fx·sfx no-op은
"나중에 구현"이 아니라 **어느 태스크에서 무엇으로 대체되는지 명시된 임시 코드**이며
제거 시점이 각각 Task 4 Step 5, Task 6 Step 1·5로 지정되어 있다.
그 외 TBD·TODO·"적절한 처리" 류 표현 없음.

**3. Type consistency**

- codec: `encode(deck, opts)` / `decode(payload)` — Task 1 정의, Task 4 Step 3·Task 3 Step 5에서 동일하게 사용
- deck: `normalize` / `validate` / `pickIndex` / `emptyDeck` / `LIMITS` / `CARD_COUNTS` / `WEIGHTS` / `DEFAULT_EMOJI` — Task 2 정의, Task 4·5에서 동일한 이름으로 사용
- fx: `burst(emoji, rarity)` / `flash()` / `shake()` — Task 5 no-op과 Task 6 구현 시그니처 일치
- sfx: `sfxPlay(name)` / `sfxSetEnabled(on)` / `sfxEnabled()` — Task 5·6 일치. `name`은 `'shuffle'|'pick'|'reveal'|'jackpot'` 4종으로 Task 6 Step 5와 Step 7이 일치
- `copyText(text)` — Task 4에서 만들고 Task 5 Step 6에서 재사용하도록 명시
- `mountBuilder(root, initialDeck, notice)` / `mountPlayer(root, deck)` — Task 3 스텁과 Task 4·5 실구현 인자 수 일치

불일치 없음.
