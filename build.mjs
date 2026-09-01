import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// 의존 대상이 먼저 오는 순서 — 단순 연결이므로 이 순서를 지켜야 한다
const MODULES = ['codec.mjs', 'deck.mjs', 'dom.mjs', 'fx.mjs', 'sfx.mjs', 'builder.mjs', 'player.mjs', 'main.mjs'];

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel) => readFileSync(p(rel), 'utf8');

const strip = (code) => code
  .replace(/^\s*import\s+[^;]*;[ \t]*$/gm, '')  // import 문 제거
  .replace(/^export\s+/gm, '')                  // export 키워드 제거
  .trim();

const missing = MODULES.filter((m) => !existsSync(p(`./src/${m}`)));
if (missing.length) {
  console.error(`빠진 모듈: ${missing.join(', ')}`);
  process.exit(1);
}

const js = MODULES.map((m) => `/* ---- ${m} ---- */\n${strip(read(`./src/${m}`))}`).join('\n\n');
const css = read('./src/style.css').trim();

if (js.includes('</script')) {
  console.error('JS 안에 </script 문자열이 있어 인라인할 수 없습니다.');
  process.exit(1);
}

mkdirSync(p('./dist/'), { recursive: true });

// 루트 index.html = GitHub Pages가 서비스하는 배포 파일
// dist/artifact.html = Claude Artifact용 (문서 골격 태그 없는 조각)
const outputs = [
  ['./src/template.html', './index.html'],
  ['./src/artifact-template.html', './dist/artifact.html'],
];

for (const [tpl, out] of outputs) {
  const html = read(tpl).replace('<!--CSS-->', () => css).replace('<!--JS-->', () => js);
  writeFileSync(p(out), html, 'utf8');
}

// 합쳐진 JS의 문법 검사
const tmp = p('./dist/.bundle-check.mjs');
writeFileSync(tmp, js, 'utf8');
try {
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
} catch (e) {
  console.error('번들 문법 오류:\n' + (e.stderr?.toString() ?? e.message));
  process.exit(1);
} finally {
  rmSync(tmp, { force: true });
}

for (const [, out] of outputs) {
  const kb = (readFileSync(p(out), 'utf8').length / 1024).toFixed(1);
  console.log(`${out} 생성 완료 (${kb} KB)`);
}
console.log(`모듈 ${MODULES.length}개 인라인, 외부 의존성 0`);
