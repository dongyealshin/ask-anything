import { encode } from './codec.mjs';
import { normalize, validate, LIMITS, CARD_COUNTS, DEFAULT_TITLE, RARITY_LABEL } from './deck.mjs';
import { el, copyText, mount } from './dom.mjs';

const PRIVACY_NOTE =
  '문구는 서버에 저장되지 않고 링크 안에 담깁니다. 링크를 가진 사람은 모든 문구를 볼 수 있으니 기밀 내용은 넣지 마세요.';

const SAMPLE = {
  t: '올여름 나의 여행운',
  q: '나를 휴가지로 이끌어 줄 카드를 골라주세요',
  n: 3,
  c: [
    { e: '🌊', m: '바다로 떠나세요.\n파도 소리가 답을 알려줍니다.', r: 1 },
    { e: '⛰️', m: '산으로 가세요. 높이 오를수록 마음이 가벼워집니다.', r: 1 },
    { e: '🏙️', m: '가까운 도시로 훌쩍. 낯선 골목에서 답을 찾게 됩니다.', r: 2 },
    { e: '🍀', m: '이번 여름, 어디를 가든 행운이 따릅니다.', r: 3 },
  ],
};

export function mountBuilder(root, initialDeck, notice) {
  const draft = initialDeck
    ? { ...normalize(initialDeck) }
    : { t: '', q: '', n: 3, c: [{ e: '', m: '', r: 1 }] };

  const rowsBox = el('div', { class: 'rows', 'data-testid': 'b-rows' });
  const counter = el('span', { class: 'counter' });
  const addBtn = el('button', {
    class: 'btn ghost add',
    type: 'button',
    'data-testid': 'b-add',
    onclick: () => {
      if (draft.c.length >= LIMITS.cards) return;
      draft.c.push({ e: '', m: '', r: 1 });
      renderRows();
      const last = rowsBox.querySelector(`[data-testid="b-message-${draft.c.length - 1}"]`);
      last?.focus();
      touched();
    },
  }, '＋ 문구 추가');

  const errorsBox = el('ul', { class: 'errors', 'data-testid': 'b-errors', hidden: true });
  const linkInput = el('input', { class: 'link-input', 'data-testid': 'b-link', readonly: true, 'aria-label': '공유 링크' });
  const copyBtn = el('button', { class: 'btn gold', type: 'button', 'data-testid': 'b-copy' }, '링크 복사');
  const tryBtn = el('a', { class: 'btn ghost', 'data-testid': 'b-try', href: '#' }, '직접 뽑아보기');
  // 페이지가 iframe 안에서 렌더되면 location.href가 주소창 주소와 다를 수 있다.
  // 이때는 붙여쓸 조각(#d=...)을 따로 보여줘서 사용자가 직접 링크를 만들 수 있게 한다.
  const embedded = (() => { try { return window.top !== window.self; } catch { return true; } })();
  const fragInput = el('input', { class: 'link-input', 'data-testid': 'b-fragment', readonly: true, 'aria-label': '주소 뒤에 붙일 부분' });
  const fragCopyBtn = el('button', { class: 'btn ghost', type: 'button', 'data-testid': 'b-fragment-copy' }, '조각 복사');
  const fragBox = el('div', { class: 'fragbox', hidden: !embedded }, [
    el('p', { class: 'fineprint', text: '위 링크가 주소창 주소와 다르면, 주소창 주소 끝에 아래 조각을 붙여서 공유하세요.' }),
    el('div', { class: 'linkrow' }, [fragInput, fragCopyBtn]),
  ]);

  const linkBox = el('div', { class: 'linkbox', hidden: true }, [
    el('p', { class: 'linkbox-title', text: '공유 링크가 만들어졌어요' }),
    el('div', { class: 'linkrow' }, [linkInput, copyBtn]),
    el('div', { class: 'linkactions' }, [tryBtn]),
    fragBox,
  ]);

  const previewBox = el('div', { class: 'preview', 'data-testid': 'b-preview' });

  const titleInput = el('input', {
    class: 'field', 'data-testid': 'b-title', maxlength: LIMITS.title,
    placeholder: DEFAULT_TITLE, value: draft.t, 'aria-label': '제목',
    oninput: (e) => { draft.t = e.target.value; touched(); },
  });

  const questionInput = el('input', {
    class: 'field', 'data-testid': 'b-question', maxlength: LIMITS.question,
    placeholder: '궁금한 걸 떠올리고 카드를 뽑으세요', value: draft.q, 'aria-label': '질문',
    oninput: (e) => { draft.q = e.target.value; touched(); },
  });

  const countPills = el('div', { class: 'pills', role: 'radiogroup', 'aria-label': '카드 장수' },
    CARD_COUNTS.map((n) => el('button', {
      class: 'pill' + (draft.n === n ? ' on' : ''),
      type: 'button', role: 'radio', 'aria-checked': String(draft.n === n),
      'data-testid': `b-count-${n}`,
      onclick: (e) => {
        draft.n = n;
        countPills.querySelectorAll('.pill').forEach((p) => {
          p.classList.remove('on');
          p.setAttribute('aria-checked', 'false');
        });
        e.currentTarget.classList.add('on');
        e.currentTarget.setAttribute('aria-checked', 'true');
        touched();
      },
    }, `${n}장`)));

  const makeBtn = el('button', {
    class: 'btn gold big', type: 'button', 'data-testid': 'b-make', onclick: makeLink,
  }, '공유 링크 만들기');

  const sampleBtn = el('button', {
    class: 'linklike', type: 'button', 'data-testid': 'b-sample',
    onclick: () => { mountBuilder(root, SAMPLE, null); },
  }, '예시로 채워보기');

  mount(root,
    el('header', { class: 'hero' }, [
      el('p', { class: 'eyebrow', text: '· TAROT DRAW ·' }),
      el('h1', { class: 'display', text: '무엇이든 물어보세요' }),
      el('p', { class: 'lead', text: '문구를 미리 써두고 링크 하나만 공유하세요. 링크를 받은 사람이 카드를 뽑으면 문구 하나가 무작위로 나옵니다.' }),
    ]),
    notice ? el('p', { class: 'notice', 'data-testid': 'b-notice', text: notice }) : null,
    el('div', { class: 'grid' }, [
      el('section', { class: 'panel' }, [
        el('h2', { class: 'panel-title', text: '1. 화면에 보일 문구' }),
        el('label', { class: 'lbl', text: '제목' }), titleInput,
        el('label', { class: 'lbl', text: '질문 한 줄' }), questionInput,
        el('label', { class: 'lbl', text: '펼칠 카드 장수' }), countPills,
        el('div', { class: 'hr' }),
        el('div', { class: 'rows-head' }, [
          el('h2', { class: 'panel-title', text: '2. 뽑히면 나올 문구' }),
          counter,
        ]),
        el('p', { class: 'hint', text: '어떤 카드를 골라도 문구는 무작위로 배정됩니다. ★가 높을수록 드물게 나와요.' }),
        rowsBox,
        el('div', { class: 'rows-foot' }, [addBtn, sampleBtn]),
        el('div', { class: 'hr' }),
        errorsBox,
        makeBtn,
        el('p', { class: 'fineprint', text: PRIVACY_NOTE }),
        linkBox,
      ]),
      el('aside', { class: 'panel preview-panel' }, [
        el('h2', { class: 'panel-title', text: '미리보기' }),
        previewBox,
      ]),
    ]),
  );

  copyBtn.addEventListener('click', async () => {
    const ok = await copyText(linkInput.value);
    copyBtn.textContent = ok ? '복사됨!' : '직접 복사해주세요';
    if (!ok) { linkInput.removeAttribute('readonly'); linkInput.select(); }
    setTimeout(() => { copyBtn.textContent = '링크 복사'; }, 1600);
  });

  fragCopyBtn.addEventListener('click', async () => {
    const ok = await copyText(fragInput.value);
    fragCopyBtn.textContent = ok ? '복사됨!' : '직접 복사해주세요';
    if (!ok) { fragInput.removeAttribute('readonly'); fragInput.select(); }
    setTimeout(() => { fragCopyBtn.textContent = '조각 복사'; }, 1600);
  });

  function touched() {
    linkBox.hidden = true;
    renderPreview();
    counter.textContent = `${draft.c.length} / ${LIMITS.cards}`;
    addBtn.disabled = draft.c.length >= LIMITS.cards;
  }

  function renderRows() {
    rowsBox.textContent = '';
    draft.c.forEach((card, i) => {
      const emoji = el('input', {
        class: 'emoji', 'data-testid': `b-emoji-${i}`, maxlength: 8, value: card.e,
        placeholder: '✨', 'aria-label': `${i + 1}번 문구의 이모지`,
        oninput: (e) => { card.e = e.target.value; touched(); },
      });
      const msg = el('textarea', {
        class: 'msg', 'data-testid': `b-message-${i}`, maxlength: LIMITS.message, rows: 2,
        placeholder: '뽑으면 보여줄 문구를 적어주세요', 'aria-label': `${i + 1}번 문구`,
        oninput: (e) => { card.m = e.target.value; touched(); },
      }, card.m);
      const rarity = el('select', {
        class: 'rarity', 'data-testid': `b-rarity-${i}`, 'aria-label': `${i + 1}번 문구의 등급`,
        onchange: (e) => { card.r = Number(e.target.value); touched(); },
      }, [1, 2, 3].map((r) => el('option', { value: r, selected: card.r === r }, RARITY_LABEL[r])));
      rarity.value = String(card.r);
      const del = el('button', {
        class: 'btn ghost del', type: 'button', 'data-testid': `b-remove-${i}`,
        'aria-label': `${i + 1}번 문구 삭제`, disabled: draft.c.length <= 1,
        onclick: () => { draft.c.splice(i, 1); renderRows(); touched(); },
      }, '×');
      rowsBox.append(el('div', { class: 'row' }, [emoji, msg, rarity, del]));
    });
  }

  function renderErrors(errs) {
    errorsBox.textContent = '';
    errorsBox.hidden = errs.length === 0;
    errs.forEach((m) => errorsBox.append(el('li', { text: m })));
  }

  function renderPreview() {
    previewBox.textContent = '';
    const filled = draft.c.filter((x) => x.m.trim().length > 0);
    previewBox.append(
      el('p', { class: 'pv-title', text: draft.t.trim() || DEFAULT_TITLE }),
      el('p', { class: 'pv-q', text: draft.q.trim() || '궁금한 걸 떠올리고 카드를 뽑으세요' }),
      el('div', { class: 'pv-cards' }, Array.from({ length: draft.n }, (_, i) =>
        el('div', { class: 'mini-card' }, [
          el('span', { class: 'mini-glyph', text: '☾' }),
          el('span', { class: 'mini-num', text: String(i + 1) }),
          el('span', { class: 'mini-glyph', text: '✦' }),
        ]))),
      el('p', { class: 'pv-meta', text: filled.length ? `문구 ${filled.length}개가 무작위로 배정됩니다` : '아직 문구가 없어요' }),
    );
  }

  async function makeLink() {
    const errs = validate(draft);
    renderErrors(errs);
    if (errs.length) return null;
    const fragment = `#d=${await encode(normalize(draft))}`;
    const url = `${location.href.split('#')[0]}${fragment}`;
    linkInput.value = url;
    fragInput.value = fragment;
    tryBtn.setAttribute('href', url);
    linkBox.hidden = false;
    linkBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return url;
  }

  renderRows();
  touched();
}
