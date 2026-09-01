# 검증 기록 — 무엇이든 물어보세요 (2026-09-01)

실행 환경: Node v24.15.0, Chromium(Playwright MCP), 로컬 정적 서버 `http://localhost:8787`
검증 대상: `dist/index.html` (빌드 산출물)

## 자동 테스트

```
node build.mjs
  ./dist/index.html 생성 완료 (37.7 KB)
  ./dist/artifact.html 생성 완료 (37.5 KB)
  모듈 8개 인라인, 외부 의존성 0

node --test test/codec.test.mjs test/deck.test.mjs test/build.test.mjs
  ℹ tests 24
  ℹ pass 24
  ℹ fail 0
```

## 스펙 10절 검증 6항목

| # | 항목 | 방법 | 실제 결과 | 판정 |
|---|---|---|---|---|
| 1 | 링크 왕복 | `test/codec.test.mjs` 압축/비압축 경로 `deepEqual` | 24/24 통과. 압축 payload가 비압축보다 짧음 | **통과 (정확)** |
| 2 | 긴 문구·줄바꿈·이모지 | 91자 + 줄바꿈 문구를 링크로 실제 뽑기 | `len 91`, `hasNewline true`, tail `타파하\n끝줄입니다.`, 박스 넘침 없음 | **통과 (정확)** |
| 3 | 문구 1개 | 문구 1개 데크로 뽑기 | 카드 3장 정상 표시, 결과 `압축 없이 만든 링크입니다.` 전량 표시 | **통과 (정확)** |
| 4 | 모바일 375px | 뷰포트 375×760, 카드 7장 | `scrollWidth 360 ≤ innerWidth 375` → 가로 스크롤 없음. 카드 3줄 배치 | **통과 (정확)** |
| 5 | 손상 해시 폴백 | `#d=zzzz` 접속 | Builder 표시(`builderShown true`, `playerShown false`) + 안내 문구 `링크가 손상된 것 같아요…` | **통과 (정확)** |
| 6 | 압축 미지원 폴백 | `encode(deck,{compress:false})` payload(`0`으로 시작)로 접속 | 제목·문구 정상 디코딩, 뽑기 완주 | **통과 (정확)** |

## 추가 확인

| 항목 | 실제 결과 | 판정 |
|---|---|---|
| 콘솔 에러 | JS 에러 0건. `favicon.ico 404`만 발생 — 테스트용 로컬 서버에 favicon이 없어서이며 사이트 코드와 무관 | 통과 |
| 키보드 조작 | Tab 2회로 카드 도달, Enter로 뽑기 실행, 결과 91자 표시 | 통과 |
| 선택 카드 중앙 이동 | 카드 영역 중심 대비 `x -6px` | 통과 |
| ★3 연출 | 금색 테두리 발광 + ★★★ 표기 + 이모지 비 + 파티클 분출 확인 | 통과 |
| 산출물 자기완결성 | `test/build.test.mjs`가 외부 http(s) 참조·stylesheet link·CDN 문자열 부재를 검사 → 통과 | 통과 |

## 검증 중 발견해 수정한 결함 5건

| 결함 | 원인 | 수정 |
|---|---|---|
| 화면 상단에 `null` 텍스트 출력 | `root.append(null)`이 DOM에서 `"null"` 문자열로 변환됨 | `dom.mjs`에 null을 걸러 붙이는 `mount()` 추가 |
| eyebrow 글자 간격 붕괴 | HTML에서 연속 공백이 하나로 합쳐짐 | 텍스트를 `· TAROT DRAW ·`로 바꾸고 간격은 `letter-spacing`으로 처리 |
| 파티클이 결과 문구를 가림 | 캔버스 `z-index:50`이 결과 패널보다 위 | 캔버스를 `z-index:5`로 내리고 결과 패널을 `z-index:10`으로 올려 카드 위·문구 아래로 배치 |
| 홀로그램 오버레이 미렌더 | `mix-blend-mode`가 3D 변환(`preserve-3d`) 컨텍스트에서 무시됨 | blend mode 제거, 반투명 무지개 그라디언트 + 금색 발광으로 대체 |
| 긴 문구 타이핑이 4.5초에도 미완 | 글자당 `setTimeout`이 타이머 클램핑에 걸림 | 시간 기반 `requestAnimationFrame`으로 교체 — 길이와 무관하게 최대 1.4초 |

## 계획 대비 의도적 편차 3건

| 항목 | 계획 | 실제 | 이유 |
|---|---|---|---|
| 모바일 카드 7장 배치 | 2줄 | 3줄 (375px 기준 3장/줄) | 2줄에 맞추려면 카드 폭을 79px까지 줄여야 해 터치 영역이 과도하게 작아진다. 가로 스크롤 없음이라는 실제 요구는 충족 |
| `burst()` 시그니처 | `burst(emoji, rarity)` | `burst(emoji, rarity, origin?)` | 뽑은 카드 위치에서 분출시키기 위한 하위호환 인자 추가 |
| 홀로그램 애니메이션 | 무한 반복 | 3회 반복 | 무한 애니메이션이 페이지를 idle 상태로 보내지 않아 스크린샷이 타임아웃되고 상시 리페인트가 발생 |
| git 저장소·커밋 | Task 0 및 각 태스크 말미 커밋 | 생략 | 사용자가 버전관리를 요청하지 않음 |

## 검증하지 못한 항목 (사용자 확인 필요)

| 항목 | 상태 |
|---|---|
| 퍼블리시된 Artifact URL에서의 실제 공유 링크 | **미검증.** 아티팩트가 비공개이고 테스트 브라우저가 claude.ai에 로그인되어 있지 않아 접근 시 "Page not found"가 반환됨. 대신 iframe 환경을 로컬에서 재현해 `location.href`가 주소창 주소와 달라지는 경우의 폴백(`#d=...` 조각 별도 표시)이 동작함을 확인했다 — `embeddedDetected true`, `fragBoxVisible true`. 최상위 창에서는 숨김(`hidden true`) |

## 스크린샷

| 파일 | 내용 |
|---|---|
| `docs/screenshots/builder-desktop.png` | 만들기 화면 (1280px, 예시 데이터) |
| `docs/screenshots/builder-mobile.png` | 만들기 화면 (375px) |
| `docs/screenshots/player-spread.png` | 카드 5장 펼침 |
| `docs/screenshots/player-result.png` | 일반 결과 (수정 전 — 파티클이 문구를 가림) |
| `docs/screenshots/player-jackpot.png` | ★3 결과 (수정 전) |
| `docs/screenshots/player-jackpot2.png` | ★3 결과 (수정 후 — 문구 가독성 확보) |
| `docs/screenshots/player-mobile.png` | 뽑기 화면 (375px, 카드 7장, 긴 문구) |
