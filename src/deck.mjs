export const LIMITS = { title: 40, question: 80, message: 200, cards: 30 };
export const WEIGHTS = { 1: 6, 2: 3, 3: 1 };
export const CARD_COUNTS = [3, 5, 7];
export const DEFAULT_TITLE = '무엇이든 물어보세요';
export const DEFAULT_EMOJI = '✨';
export const RARITY_LABEL = { 1: '★ 흔함', 2: '★★ 조금 귀함', 3: '★★★ 매우 귀함' };

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
