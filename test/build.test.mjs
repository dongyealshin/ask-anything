import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const p = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const DIST = p('../index.html');
const ARTIFACT = p('../dist/artifact.html');

test('빌드가 배포 파일과 아티팩트 파일을 만든다', () => {
  execFileSync(process.execPath, [p('../build.mjs')], { stdio: 'pipe' });
  assert.ok(existsSync(DIST));
  assert.ok(existsSync(ARTIFACT));
});

test('산출물에 외부 리소스 참조가 없다', () => {
  for (const f of [DIST, ARTIFACT]) {
    const html = readFileSync(f, 'utf8');
    assert.doesNotMatch(html, /src\s*=\s*["']https?:/i, f);
    assert.doesNotMatch(html, /href\s*=\s*["']https?:/i, f);
    assert.doesNotMatch(html, /<link[^>]+stylesheet/i, f);
    assert.doesNotMatch(html, /cdnjs|jsdelivr|unpkg|fonts\.googleapis/i, f);
  }
});

test('주입 마커가 남아있지 않다', () => {
  for (const f of [DIST, ARTIFACT]) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /<!--CSS-->|<!--JS-->/, f);
  }
});

test('산출물에 import/export 잔재가 없다', () => {
  for (const f of [DIST, ARTIFACT]) {
    const html = readFileSync(f, 'utf8');
    assert.doesNotMatch(html, /^\s*import\s+.*from\s+/m, f);
    assert.doesNotMatch(html, /^\s*export\s+/m, f);
  }
});

test('사이트명이 title에 들어있다', () => {
  for (const f of [DIST, ARTIFACT]) {
    assert.match(readFileSync(f, 'utf8'), /<title>무엇이든 물어보세요<\/title>/, f);
  }
});

test('아티팩트 산출물에는 문서 골격 태그가 없다', () => {
  const html = readFileSync(ARTIFACT, 'utf8');
  assert.doesNotMatch(html, /<!doctype|<html|<head|<body/i);
});
