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
  const big = {
    ...deck,
    c: Array.from({ length: 12 }, () => ({ e: '✨', m: '반복되는 긴 문구입니다. 압축이 잘 되어야 합니다.', r: 1 })),
  };
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

test('200자 문구와 줄바꿈, 이모지가 왕복에서 보존된다', async () => {
  const long = 'ㄱ'.repeat(90) + '\n' + '나다라'.repeat(30);
  const d = { t: '테스트 🎴', q: '질문 ✨', n: 7, c: [{ e: '🔥', m: long.slice(0, 200), r: 3 }] };
  assert.deepEqual(await decode(await encode(d)), d);
});
