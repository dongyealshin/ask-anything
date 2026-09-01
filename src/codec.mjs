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
    } catch { /* 압축 실패 시 원문 경로로 폴백 */ }
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
