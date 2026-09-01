# 무엇이든 물어보세요

문구를 미리 써두고 링크 하나를 공유하면, 링크를 받은 사람이 카드를 뽑아 문구 하나를 무작위로 보는 카드 뽑기 사이트.

**사이트:** https://dongyealshin.github.io/ask-anything/

## 구조

| 경로 | 역할 |
|---|---|
| `index.html` | 배포 파일 (빌드 산출물). GitHub Pages가 이 파일을 서비스한다 |
| `src/*.mjs` | 책임별 소스 모듈. `codec`(링크 인코딩) · `deck`(모델·추첨) · `builder`(만들기 화면) · `player`(뽑기 화면) · `fx`(파티클) · `sfx`(효과음) |
| `src/style.css` | 전체 스타일 |
| `build.mjs` | src를 인라인해 `index.html`과 `dist/artifact.html` 생성 |
| `test/` | `node --test` 단위 테스트 |
| `docs/` | 설계 스펙 · 구현 계획 · 검증 기록 · 스크린샷 |

## 개발

```bash
node build.mjs                                                  # 빌드
node --test test/codec.test.mjs test/deck.test.mjs test/build.test.mjs   # 테스트
```

`src/`를 수정한 뒤 `node build.mjs`로 다시 빌드하고 커밋·푸시하면 GitHub Pages에 반영된다.

## 동작 방식

문구는 서버에 저장하지 않는다. 입력값을 JSON → UTF-8 → deflate 압축 → base64url로 만들어 URL 해시(`#d=...`)에 담는다.
`CompressionStream` 미지원 브라우저에서는 압축 없이 인코딩하며, payload 첫 글자(`1`=압축, `0`=원문)로 구분해 어느 브라우저에서 만든 링크든 열린다.

링크를 가진 사람은 전체 문구를 볼 수 있으므로 기밀 내용에는 쓰지 않는다.

## 외부 의존성

없음. CDN·웹폰트·이미지·사운드 파일을 쓰지 않고 `index.html` 한 파일로 완결된다.
