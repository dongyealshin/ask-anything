// fx.mjs는 DOM·캔버스에 의존하므로 모듈째 import할 수 없다.
// 대신 성능 회귀의 핵심인 상수와 budget 산식을 소스에서 추출해 검증한다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('../src/fx.mjs', import.meta.url)), 'utf8');

const num = (name) => {
  const m = new RegExp(`const ${name} = ([\\d.]+)`).exec(src);
  assert.ok(m, `${name} 상수를 찾을 수 없다`);
  return Number(m[1]);
};

test('DPR 캡이 걸려 있다 (전체화면 캔버스 픽셀 폭발 방지)', () => {
  const cap = num('MAX_DPR');
  assert.ok(cap <= 1.5, `MAX_DPR=${cap} — 1.5 이하여야 한다`);
});

test('살아있는 파티클 상한이 걸려 있다', () => {
  const cap = num('HARD_CAP');
  assert.ok(cap > 0 && cap <= 300, `HARD_CAP=${cap} — 300 이하여야 한다`);
});

test('budget이 상한을 넘겨 파티클을 추가하지 않는다', () => {
  const HARD_CAP = num('HARD_CAP');
  // 소스의 budget 산식을 그대로 재현
  const budget = (count, alive, scale = 1, quality = 1, areaScale = 1) => {
    const wanted = Math.round(count * scale * quality * (0.55 + 0.45 * areaScale));
    const room = Math.max(0, HARD_CAP - alive);
    return Math.min(Math.max(wanted, 12), room);
  };
  assert.equal(budget(140, HARD_CAP), 0, '가득 찼으면 0을 줘야 한다');
  assert.equal(budget(140, HARD_CAP + 50), 0, '초과 상태에서도 0');
  assert.equal(budget(140, HARD_CAP - 5), 5, '남은 자리만큼만');
  for (const alive of [0, 50, 120, 200, 239, 240]) {
    for (const count of [60, 90, 140]) {
      assert.ok(alive + budget(count, alive) <= HARD_CAP,
        `alive=${alive} count=${count} → 상한 초과`);
    }
  }
});

test('저사양 기기에서 파티클을 줄인다', () => {
  const m = /if \(cores <= 2 \|\| mem <= 2\) return ([\d.]+);/.exec(src);
  assert.ok(m, 'deviceScale의 저사양 분기를 찾을 수 없다');
  assert.ok(Number(m[1]) < 1, '저사양 계수는 1보다 작아야 한다');
});

test('프레임이 밀리면 스스로 품질을 낮춘다', () => {
  assert.match(src, /emaFrame > 26/, '프레임 지연 감지 임계값이 없다');
  assert.match(src, /quality = Math\.max\(0\.35, quality - /, '자동 스로틀 하향 로직이 없다');
});

test('이모지를 스프라이트로 캐시해 fillText를 매 프레임 호출하지 않는다', () => {
  assert.match(src, /sprites\.set\(ch, s\)/, '스프라이트 캐시가 없다');
  assert.match(src, /c\.drawImage\(p\.sp/, '파티클을 drawImage로 그리지 않는다');
  // 루프 안에서 fillText/font 설정이 사라졌는지
  const loopBody = /function loop\(now\) \{[\s\S]*?\n\}/.exec(src)[0];
  assert.doesNotMatch(loopBody, /fillText/, '루프에서 여전히 fillText를 쓴다');
  assert.doesNotMatch(loopBody, /\.font\s*=/, '루프에서 여전히 font를 설정한다');
  assert.doesNotMatch(loopBody, /c\.save\(\)/, '루프에서 여전히 save/restore를 쓴다');
});

test('물리가 dt 기반이라 프레임레이트에 좌우되지 않는다', () => {
  const loopBody = /function loop\(now\) \{[\s\S]*?\n\}/.exec(src)[0];
  assert.match(loopBody, /const dt = Math\.min\(rawDt/, 'dt 계산이 없다');
  assert.match(loopBody, /p\.x \+= p\.vx \* dt/, '위치 갱신이 dt를 쓰지 않는다');
});
