import { decode } from './codec.mjs';
import { normalize } from './deck.mjs';
import { mountBuilder } from './builder.mjs';
import { mountPlayer } from './player.mjs';

const root = document.getElementById('app');
let currentHash = null;

function readPayload() {
  const m = /^#d=(.+)$/.exec(location.hash);
  return m ? m[1] : null;
}

async function route() {
  if (location.hash === currentHash) return;
  currentHash = location.hash;
  const payload = readPayload();
  if (!payload) {
    mountBuilder(root, null, null);
    return;
  }
  try {
    mountPlayer(root, normalize(await decode(payload)));
  } catch {
    mountBuilder(root, null, '링크가 손상된 것 같아요. 아래에서 문구를 새로 만들어 공유해보세요.');
  }
}

window.addEventListener('hashchange', route);
route();
