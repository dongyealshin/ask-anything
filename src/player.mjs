import { pickIndex, RARITY_LABEL } from './deck.mjs';
import { el, wait, reducedMotion, copyText, mount } from './dom.mjs';
import { burst, rain, flash, shake } from './fx.mjs';
import { sfxPlay, sfxSetEnabled, sfxEnabled, vibrate } from './sfx.mjs';

export function mountPlayer(root, deck) {
  let state = 'intro';
  let resultIdx = null;

  const cardsBox = el('div', { class: 'cards', 'data-testid': 'p-cards' });
  const shuffleBtn = el('button', {
    class: 'btn gold big', type: 'button', 'data-testid': 'p-shuffle', onclick: () => shuffle(),
  }, '카드 섞기');

  const resultEmoji = el('div', { class: 'res-emoji', 'data-testid': 'p-result-emoji' });
  const resultRarity = el('div', { class: 'res-rarity', 'data-testid': 'p-result-rarity' });
  const resultMsg = el('p', { class: 'res-msg', 'data-testid': 'p-result-message' });
  const againBtn = el('button', { class: 'btn gold', type: 'button', 'data-testid': 'p-again', onclick: () => shuffle() }, '한 번 더 뽑기');
  const copyBtn = el('button', { class: 'btn ghost', type: 'button', 'data-testid': 'p-copy' }, '링크 복사');
  const createBtn = el('button', {
    class: 'btn ghost', type: 'button', 'data-testid': 'p-create',
    onclick: () => { location.hash = ''; location.reload(); },
  }, '나도 만들기');

  const resultBox = el('section', { class: 'result', 'data-testid': 'p-result', hidden: true }, [
    resultEmoji, resultRarity, resultMsg,
    el('div', { class: 'res-actions' }, [againBtn, copyBtn, createBtn]),
  ]);

  const soundBtn = el('button', {
    class: 'sound', type: 'button', 'data-testid': 'p-sound',
    'aria-label': '효과음 켜기 끄기',
    onclick: () => { sfxSetEnabled(!sfxEnabled()); paintSound(); },
  });

  mount(root,
    soundBtn,
    el('header', { class: 'hero play-hero' }, [
      el('p', { class: 'eyebrow', text: '· TAROT DRAW ·' }),
      el('h1', { class: 'display', 'data-testid': 'p-title', text: deck.t }),
      deck.q ? el('p', { class: 'lead', 'data-testid': 'p-question', text: deck.q }) : null,
    ]),
    el('div', { class: 'stage' }, [cardsBox, el('div', { class: 'stage-foot' }, [shuffleBtn])]),
    resultBox,
    el('p', { class: 'fineprint center', text: '이 링크는 문구를 담고 있어요. 그대로 공유하면 누구나 뽑을 수 있습니다.' }),
  );

  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(location.href);
    copyBtn.textContent = ok ? '복사됨!' : '직접 복사해주세요';
    setTimeout(() => { copyBtn.textContent = '링크 복사'; }, 1600);
  });

  function paintSound() {
    soundBtn.textContent = sfxEnabled() ? '🔊' : '🔇';
    soundBtn.setAttribute('aria-pressed', String(sfxEnabled()));
  }
  paintSound();

  function buildCards() {
    cardsBox.textContent = '';
    const mid = (deck.n - 1) / 2;
    for (let i = 0; i < deck.n; i++) {
      const offset = i - mid;
      const front = el('span', { class: 'card-front' }, [
        el('span', { class: 'front-emoji' }),
        el('span', { class: 'front-star' }),
      ]);
      const back = el('span', { class: 'card-back' }, [
        el('span', { class: 'glyph', text: '☾' }),
        el('span', { class: 'num', text: String(i + 1) }),
        el('span', { class: 'glyph', text: '✦' }),
      ]);
      const card = el('button', {
        class: 'card stacked', type: 'button', 'data-testid': `p-card-${i}`,
        'aria-label': `${i + 1}번 카드 뽑기`,
        style: `--rot:${(offset * 4).toFixed(2)}deg; --dy:${(offset * offset * 3).toFixed(1)}px; --delay:${i * 70}ms`,
        onclick: () => choose(i),
      }, [el('span', { class: 'card-inner' }, [back, front])]);
      cardsBox.append(card);
    }
  }

  async function shuffle() {
    if (state === 'shuffle' || state === 'focus' || state === 'reveal') return;
    state = 'shuffle';
    resultBox.hidden = true;
    resultIdx = null;
    shuffleBtn.hidden = true;
    cardsBox.classList.add('shuffling');
    sfxPlay('shuffle');
    buildCards();
    await wait(reducedMotion() ? 60 : 420);
    cardsBox.classList.remove('shuffling');
    cardsBox.querySelectorAll('.card').forEach((c) => c.classList.remove('stacked'));
    await wait(reducedMotion() ? 60 : 620);
    state = 'spread';
  }

  async function choose(i) {
    if (state !== 'spread') return;
    state = 'focus';
    sfxPlay('pick');
    resultIdx = pickIndex(deck);
    const cards = [...cardsBox.querySelectorAll('.card')];
    // 선택 카드를 카드 영역 중앙으로 옮긴다 (여러 줄로 감싸였을 때도 중앙에 오도록)
    const picked = cards[i].getBoundingClientRect();
    const wrap = cardsBox.getBoundingClientRect();
    cards[i].style.setProperty('--cx', `${Math.round(wrap.left + wrap.width / 2 - picked.left - picked.width / 2)}px`);
    cards[i].style.setProperty('--cy', `${Math.round(wrap.top + wrap.height / 2 - picked.top - picked.height / 2)}px`);
    cards.forEach((c, idx) => c.classList.add(idx === i ? 'chosen' : 'dimmed'));
    await wait(reducedMotion() ? 60 : 430);
    await reveal(cards[i]);
  }

  async function reveal(card) {
    state = 'reveal';
    const item = deck.c[resultIdx];
    card.querySelector('.front-emoji').textContent = item.e;
    card.querySelector('.front-star').textContent = '★'.repeat(item.r);
    if (item.r >= 3) card.classList.add('holo');
    flash();
    sfxPlay('reveal');
    vibrate(item.r);
    card.classList.add('revealed');
    await wait(reducedMotion() ? 80 : 680);
    const box = card.getBoundingClientRect();
    await showResult(item, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  }

  async function showResult(item, origin) {
    state = 'result';
    resultEmoji.textContent = item.e;
    resultRarity.textContent = RARITY_LABEL[item.r];
    resultRarity.className = `res-rarity r${item.r}`;
    resultBox.hidden = false;
    resultBox.classList.toggle('jackpot', item.r >= 3);
    burst(item.e, item.r, origin);
    if (item.r >= 3) { shake(); rain(item.e, 40); sfxPlay('jackpot'); }
    await type(resultMsg, item.m);
  }

  /**
   * 시간 기반 타이핑. 글자당 setTimeout을 쓰면 타이머 클램핑에 걸려
   * 긴 문구가 몇 초씩 늦어지므로, rAF로 경과 시간에서 진행률을 계산한다.
   */
  function type(node, text) {
    if (reducedMotion()) { node.textContent = text; return Promise.resolve(); }
    const chars = [...text];
    const dur = Math.min(1400, 45 * chars.length);
    node.textContent = '';
    return new Promise((resolve) => {
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        node.textContent = chars.slice(0, Math.ceil(p * chars.length)).join('');
        if (p < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
  }

  buildCards();
}
