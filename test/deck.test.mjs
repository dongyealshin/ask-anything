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
  const ratio = rare / 6000;
  assert.ok(ratio > 0.08 && ratio < 0.22, `ratio=${ratio}`);
});
