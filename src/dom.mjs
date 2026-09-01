export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export const qs = (sel, root = document) => root.querySelector(sel);

/** null/false 자식을 걸러서 붙인다 (DOM append는 null을 "null" 문자열로 바꾼다) */
export function mount(root, ...nodes) {
  root.textContent = '';
  for (const n of nodes) if (n) root.append(n);
}
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const reducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* execCommand 폴백으로 진행 */ }
  try {
    const ta = el('textarea', { value: text, style: 'position:fixed;opacity:0;top:0;left:0' });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
