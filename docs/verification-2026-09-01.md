# 검증 기록 — 무엇이든 물어보세요 (2026-09-01)

실행 환경: Node v24.15.0, Chromium(Playwright MCP), 로컬 정적 서버 `http://localhost:8787`
검증 대상: `index.html` (빌드 산출물)

## 자동 테스트

```
node build.mjs
  ./index.html 생성 완료 (40.5 KB)
  ./dist/artifact.html 생성 완료 (40.2 KB)
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

## 배포처 변경 (2026-09-01 추가)

Claude Artifact는 보는 사람도 Claude 로그인이 필요해 공개 공유에 부적합하다는 사용자 피드백에 따라
**GitHub Pages**로 배포처를 변경했다.

- 저장소: https://github.com/dongyealshin/ask-anything (public)
- 사이트: https://dongyealshin.github.io/ask-anything/
- 배포 파일: 루트 `index.html` (Pages source = `main` / `/`)
- iframe 환경 폴백(`#d=...` 조각 별도 표시)은 그대로 유지 — 로컬 iframe 재현으로 동작 확인(`embeddedDetected true`, `fragBoxVisible true`), 최상위 창에서는 숨김(`hidden true`)

### 라이브 URL 실검증 (로그인 없이 접근 가능해 이제 검증 가능해진 항목)

| 항목 | 실제 결과 | 판정 |
|---|---|---|
| 공유 링크가 주소창 주소와 일치 | `matchesAddressBar: true`. 생성 링크 `https://dongyealshin.github.io/ask-anything/#d=1bZH…` | **통과 (정확)** |
| iframe 아님 → 조각 폴백 숨김 | `embedded: false`, `fragBoxHidden: true` | 통과 |
| HTTPS 보안 컨텍스트 | `isSecureContext: true` → `navigator.clipboard` 복사 경로 사용 가능 | 통과 |
| 생성한 링크를 새로 열어 뽑기 완주 | 제목 `올여름 나의 여행운`, 질문·카드 3장 정상, 결과 `🌊 / ★ 흔함 / 바다로 떠나세요.
파도 소리가 답을 알려줍니다.` | **통과 (정확)** |
| 라이브 콘솔 에러 | `favicon.ico 404` 1건만 발생 → 인라인 SVG favicon 추가로 제거하고 재발 방지 테스트 추가 | 수정 완료 |
| 배포 파일 자기완결성 | GitHub raw로 받은 `index.html`에서 외부 http(s) 참조 0건, 43,124 bytes | 통과 |

스크린샷: `docs/screenshots/live-builder.png` (라이브 사이트 첫 화면)

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


---

# 성능 최적화 (2026-09-01 추가)

"이모티콘 이펙트 나올 때 렉이 걸린다"는 사용자 보고에 대응.

## 측정 환경의 한계 (먼저 명시)

헤드리스 Chromium은 컴포지터가 돌지 않아 **프레임레이트를 측정할 수 없다** — 2.6초 동안
`requestAnimationFrame`이 2회만 실행됐다. 따라서 실제 fps 개선치는 **미검증**이며,
아래 수치는 파티클 렌더링에 드는 **메인스레드 작업량**을 마이크로벤치로 잰 것이다.

## 원인 분석

첫 가설(이모지 `fillText` 비용)만으로는 설명되지 않았다. 소프트웨어 렌더링 기준 180개
× 1.64ms/프레임으로 절대값이 작았기 때문이다. 구조적으로 비싼 원인을 4개 찾았다.

| 원인 | 문제 |
|---|---|
| 전체화면 캔버스를 DPR 그대로 사용 | DPR 2 환경에서 매 프레임 3840×2160 텍스처를 GPU에 업로드 |
| `holo`의 `background-position` 애니메이션 | 컴포지터 가속이 안 되어 3.4초 × 3회 동안 매 프레임 카드 전체(44px 그림자 포함)를 재페인트 — 파티클과 정확히 동시에 발생 |
| `shake()`가 `#app` 전체에 transform | 3D 카드 서브트리 전체가 재래스터화 (레이어 승격 힌트 없음) |
| 물리 연산이 `1/60` 고정 | 저사양에서 느려지고 120Hz에서 2배 빨라짐 — 렉을 체감상 악화 |

부수적으로 파티클마다 `size: 14 + Math.random()*20`(연속 float)을 써서 글리프 캐시가
매 파티클·매 프레임 미스됐고, `parts.filter()`가 프레임당 배열을 새로 할당했다.

## 조치

| 항목 | 변경 |
|---|---|
| 이모지 렌더 | 이모지당 1회 72px 스프라이트로 굽고 `drawImage`로 그림. 루프에서 `fillText`·`font` 설정·`save/restore` 제거 |
| 캔버스 해상도 | `MAX_DPR = 1.5` 캡 → DPR 2 환경에서 픽셀 44% 감소 |
| holo | `background-position` → `transform: translate3d` (컴포지터 가속) + `will-change` |
| shake | `.shaking`에 `will-change: transform`, keyframes를 `translate3d`로 |
| 별 반짝임 | `body::before`에 `will-change: opacity`로 레이어 승격 |
| 물리 | dt 기반(1/30 클램프)으로 전환 — 프레임레이트 무관하게 동일 속도 |
| 배열 | `filter()` 제거, 제자리 압축으로 프레임당 GC 제거 |
| 기기 대응 | `hardwareConcurrency`/`deviceMemory`로 파티클 계수 0.45~1.0, 화면 면적 반영 |
| 자동 스로틀 | 프레임 EMA가 26ms를 넘으면 품질 계수를 단계적으로 낮추고 살아있는 파티클을 30% 덜어냄. 회복되면 서서히 복귀 |
| 상한 | 살아있는 파티클 `HARD_CAP = 240` |

## 측정 결과 (마이크로벤치, 1440×900 캔버스, 60프레임 평균)

| 파티클 수 | 개선 전 | 개선 후 | 배수 |
|---|---|---|---|
| 60개 (★1) | 0.44 ms/프레임 | 0.26 ms/프레임 | 1.69× |
| 180개 (★3 최악) | 2.96 ms/프레임 | 0.51 ms/프레임 | **5.8×** |

개선 전 = DPR 2 캔버스 + `save/restore` + `font` 문자열 + `fillText`
개선 후 = DPR 1.5 캔버스 + 스프라이트 + `setTransform` + `drawImage`

`holo`·`shake`·별 반짝임의 컴포지팅 개선은 마이크로벤치로 잴 수 없어 수치가 없다.
체감 렉의 상당 부분이 여기에 있었을 가능성이 높다.

## 코드 검토에서 잡은 결함 2건

| 결함 | 수정 |
|---|---|
| `budget()`의 `Math.max(12, ...)`가 `HARD_CAP`을 무력화 — 상한을 넘겨 파티클 추가 | 남은 자리를 먼저 계산해 `Math.min(Math.max(wanted,12), room)`으로 변경 |
| 캔버스 컨텍스트 객체에 커스텀 속성(`ctx2d.dpr`)을 붙이는 몽키패칭 | 모듈 변수 `dprScale`로 분리 |

## 회귀 방지 테스트

`test/fx-budget.test.mjs` 7개 추가 (전체 **32/32 통과**) — DPR 캡, 파티클 상한,
`budget` 산식이 상한을 넘지 않음, 저사양 계수, 자동 스로틀 존재, 루프에서
`fillText`/`font`/`save` 미사용, dt 기반 물리.

## 부수 효과

`holo`를 transform 방식으로 바꾸면서 **홀로그램 오버레이가 처음으로 제대로 렌더**된다.
이전에는 `mix-blend-mode` 제거 후에도 `background-position` 방식이 3D 변환 컨텍스트에서
보이지 않았다. 스크린샷: `docs/screenshots/opt-jackpot.png`(★3), `opt-normal.png`(★2)
