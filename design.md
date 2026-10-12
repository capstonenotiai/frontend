# Design — NotiAI

NotiAI 프론트의 잠긴 디자인 시스템이다. 모든 화면 구현과 Codex 지시서는 코드를 쓰기 전에 이 파일을 먼저 읽는다. 화면마다 새로 정하지 않는다. 시스템이 커져야 하면 이 파일을 고친다.

- 근거: `docs-local/REDESIGN_PLAN.md`(구성·결정 기록, git 제외), 시안 `docs-local/mockups/dashboard.html`(디자인 A + Hallmark audit 반영)
- 만든 날: 2026-10-11 (Hallmark multi-page flow, 디자인 A "맑은 블루" 선택)

## Genre
modern-minimal (SaaS 대시보드 계열). 순수 흰 카드와 채도 낮은 회색을 허용한다.

## Macrostructure family
- 앱 화면: **Workbench** — 왼쪽 사이드바(메뉴 / 일정 하위: 전체 공지·관심 저장·숨긴 공지 / AI 플래너 / 캘린더 / 설정 / 피드백) + 위쪽 막대(제목·알림) + 본문 카드. 홈은 **주간 달력**(오늘부터 7일 한 줄 달력: 칸 안에 등록 일정 칩 — 전체 제목 한 줄 + 말줄임 — 과 여러 날 일정 막대, 오늘 칸 강조, ‹ › 7일 이동, 완료 수, 일정·막대를 누르면 달력 아래 상세 펼침) + 아래 새로 올라온 공지(4건 + "나머지 N건 더 보기"). 2026-10-11 확정, 시안 `docs-local/mockups/dashboard.html`.
- 펼친 상세의 [수정]은 흐린 글자 12px(`--color-muted`), 마우스 올림·포커스 때만 강조색 밑줄.
- 마케팅(랜딩): **Narrative Workflow + 좌우 번갈아 기능 줄**. 고정 내비 → 가운데 첫 화면("공지 속 날짜를 캘린더로", 양옆에 떠 있는 예시 조각) → 공지 원문 → 정리된 일정 → 캘린더 3칸 → 기능 3개(목록·알림·AI 플래너) → 연동 사이트 카드 3장 + 흐름선 → 남색 띠 → 한 줄 바닥글.
- 관리자 검토: 앱 화면과 같은 틀, 우선순위 낮음.

## Theme
| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-canvas` | `#F4F6FB` | 앱 바탕 |
| `--color-paper` | `#FFFFFF` | 카드, 사이드바, 떠 있는 창 |
| `--color-paper-2` | `#F3F5FA` | 옅은 면(입력칸, 칩, 펼친 상세, 마우스 올림) |
| `--color-paper-3` | `#E6EAF2` | 진한 면(눌림, 진행 막대 바탕) |
| `--color-ink` | `#171C26` | 본문 글자 |
| `--color-ink-2` | `#545D6E` | 보조 글자 |
| `--color-muted` | `#687080` | 흐린 글자(흰 바탕 4.98:1, 옅은 면 4.56:1). 이보다 흐린 글자는 쓰지 않는다 |
| `--color-rule` | `#E9ECF2` | 구분선 |
| `--color-control` | `#C3CAD6` | 체크 상자·스위치 테두리(글자에는 쓰지 않음) |
| `--color-accent` | `#3B5BDB` | 주 버튼, 선택, 링크, 진행도 |
| `--color-accent-strong` | `#2F4AC0` | 주 버튼 마우스 올림 |
| `--color-accent-soft` | `#EDF1FF` | 선택된 메뉴, 켜진 상태 면 |
| `--color-on-accent` | `#FFFFFF` | 강조색 위 글자(5.67:1) |
| `--color-danger` | `#C92A2A` | D-7 이내 임박 D-day(5.46:1), 오류 |
| `--color-new` | `#FFE36E` | NEW 표시 바탕(글자는 ink) |
| `--color-check-bg` / `--color-check-fg` | `#FFF2CC` / `#7A5000` | "확인 필요" 표시(6.33:1) |
| `--color-star` | `#E0A100` | 관심 저장 별(아이콘 전용) |
| `--color-focus` | `#3B5BDB` | 키보드 포커스 링 |

### 분야 색 (점 / 옅은 면 / 글자)
| 분야 | 점 | 면 | 글자 | 대비 |
|---|---|---|---|---|
| 장학 | `#19A974` | `#E3F6EE` | `#0B6E49` | 5.59 |
| 학사 | `#3D7BF7` | `#E6EFFE` | `#1C4FC4` | 6.12 |
| 진로·취업 | `#8B5CF6` | `#F0EAFE` | `#5B33C6` | 6.55 |
| 공모전 | `#F2994A` | `#FDF0E4` | `#9A4A0C` | 5.59 |
| 대외활동 | `#E5579B` | `#FCE8F2` | `#A3245F` | 6.04 |

분야 색은 분야 표시(작은 칩), 캘린더 일정 칸(옅은 면 + 앞쪽 색 점), 필터 칩의 점에만 쓴다. 강조색(인디고)과 섞지 않는다.

## Typography
- 글꼴: **Pretendard** 하나(400, 500, 600, 700). 2026-10-11 IBM Plex Sans KR과 비교 후 사용자 선택(`docs-local/mockups/font-compare.png`).
- 불러오기: npm `pretendard` 패키지의 **dynamic subset**(`pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css`)을 앱 진입점에서 import. Google Fonts에는 없다.
- 대체: `-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`.
- 시안(아티팩트)은 Google Fonts만 쓸 수 있어 IBM Plex Sans KR로 그려져 있다. Pretendard는 같은 크기에서 조금 작고 촘촘해 보이므로, 구현 후 12~13px 글자가 흐려 보이면 한 단계 키운다.
- 크기: 12(보조·표시) / 13(목록 보조, 버튼) / 14(본문 기본) / 15(목록 제목, D-day) / 16(카드 제목) / 18(진행도 문장) / 20(화면 제목) / 24(진행도 숫자). 숫자는 `font-variant-numeric: tabular-nums`.
- 제목은 기울이지 않는다. 대문자 꾸밈 글자, 장식용 머리글은 쓰지 않는다.

## Spacing
4px 단위 이름 붙인 간격만 쓴다: `--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32. 예외는 0·1·2px(테두리, 아주 작은 칩 위아래)뿐.

## Shape & depth
- 모서리: `--radius-sm` 8(버튼, 입력칸), `--radius-md` 12(펼친 상세, 떠 있는 작은 창), `--radius-lg` 16(카드), `--radius-pill` 999(칩, 필터).
- 그림자: 카드 `--shadow-card`(아주 옅게), 떠 있는 것(알림 패널, 캘린더 상세 창, 메뉴, 안내, 확인 창) `--shadow-pop`, 채팅 버튼 `--shadow-fab`.
- 금지: 카드 안에 또 카드(펼친 상세 안에서는 상자 없이 글과 선만), 왼쪽·오른쪽 굵은 색 띠 테두리, 그라데이션 장식.

## Motion
- 시간 150ms, 이징 `cubic-bezier(0.16, 1, 0.3, 1)`(`--ease-out`).
- 색(background, color)과 `transform`, `opacity`만 움직인다. width·height·left·margin은 움직이지 않는다.
- 눌림: `transform: translateY(1px)`. 스위치 손잡이: `translateX`.
- `prefers-reduced-motion: reduce`이면 움직임을 끄고 바로 바뀐다. 포커스 링은 항상 즉시 나타난다.

## Microinteractions stance
- 성공은 조용히. 결과가 화면에 보이는 동작(체크, 저장, 다시 반영)은 안내를 띄우지 않는다.
- 되돌릴 수 있는 동작(관심 없음, 등록 해제)은 확인 창 없이 바로 실행하고, 화면 아래에 "되돌리기" 안내를 5초 띄운다.
- 확인 창은 "확인 필요" 일정을 등록할 때만: "공지에서 날짜를 한 번 확인해 주세요".
- 결과가 안 보이는 동작(신고·의견 보내기, 다른 화면으로 옮겨 간 일정)은 짧은 안내를 띄운다.
- 아이콘은 한 세트의 SVG(선 굵기 2)만. 이모지 금지. 장식 아이콘은 `aria-hidden`, 아이콘만 있는 버튼은 `aria-label`.
- 목록 줄은 키보드로 열린다(`button` 또는 `role="button"` + Enter/Space, `aria-expanded`).

## CTA voice
- 주 버튼: 인디고 채움 + 흰 글자, 모서리 8, 높이 약 36(padding 8×16), 글자 13~14 600. 예: "일정 등록", "추천 받기", "신고하기".
- 보조 버튼: 옅은 회색 면(`--color-paper-2`) + ink 글자. 예: "관심 저장", "숨김 해제".
- 조용한 버튼: 배경 없음 + `--color-ink-2` 글자. 예: "관심 없음", "등록 해제", "저장 해제", "접기".
- 글자 링크: 강조색 600. 예: "원문 보기", "캘린더 보기", "모두 보기".
- 버튼 이름은 무슨 일이 일어나는지 그대로 쓴다. 같은 동작은 어디서나 같은 이름.
- 모든 버튼·입력은 8가지 상태를 가진다: 기본, 마우스 올림, 키보드 포커스, 눌림, 비활성, 불러오는 중, 오류, 완료.

## Per-page allowances
- 앱 화면: 장식(일러스트, 큰 그림) 없음. 기능이 화면을 채운다.
- 랜딩(시안 `docs-local/mockups/landing-3.html`, 2026-10-11): 색·글꼴·버튼은 이 시스템. 앱 화면보다 움직임을 더 쓸 수 있다.
  - 시간: 기본 150ms 외에 `--dur-med` 320ms(떠오르기·그림자), `--dur-long` 700ms(첫 화면 등장). 이징은 `--ease-out`, 오르내림은 `--ease-in-out`.
  - 움직이는 것: transform 계열(`translate`, `scale`, `rotate`), opacity, 색, **그림자**(랜딩만 허용).
  - 떠오르기(`translate -6px` + `--shadow-lift`)는 누를 수 있는 카드에만. 누를 수 없는 카드는 그림자만 짙게(`--shadow-float`). 마우스 올림 효과는 요소마다 최대 2가지.
  - 스크롤 등장은 scroll-driven(`animation-timeline: view()`)으로. 지원하지 않는 브라우저에서는 처음부터 보인다.
  - 자동으로 바뀌는 내용(원문↔일정 강조)은 마우스나 포커스가 그 구역에 있으면 멈춘다.
  - `prefers-reduced-motion: reduce`면 모든 움직임을 끈다.
  - 추가 토큰: `--radius-xs` 4(작은 표시·달력 칸), `--shadow-lift`, `--shadow-float`, `--shadow-accent`, `--shadow-nav`, `--google-*`(Google 로고 4색, 로그인 버튼에만). 남색 띠 `--color-band` #1B2440 / `--color-band-ink` #FFFFFF / `--color-band-sub` #C9D1E6(띠 위 보조 글자, 대비 10:1 이상), 초록 점 퍼짐 `--live-ring` rgba(52,168,83,.45) → `--live-ring-0` rgba(52,168,83,0), `--ease-in-out` cubic-bezier(0.65, 0, 0.35, 1). 값은 `docs-local/mockups/landing-3.html`의 `:root`와 같다.
- 문구는 짧게. 안내 문장은 꼭 필요한 한 줄만. 내부 코드값(career, act 등)은 화면에 쓰지 않는다.

## What pages MUST share
- 사이드바와 위쪽 막대, 강조색과 그 쓰임(선택·주 버튼·링크·진행도), 글꼴(Pretendard), 버튼 모양, 카드 모서리·그림자, 분야 색, D-day 표기(D-n, 임박은 빨강).

## What pages MAY differ on
- 본문 카드의 배치(한 칸 / 두 칸 / 달력 격자), 카드 안 목록의 모양(줄, 추천 카드, 폼).

## Open items
- 모바일 배치(320~768px): 아직 없음. 정한 뒤 이 파일에 추가한다(사이드바 → 아래 탭 또는 접는 메뉴, 두 칸 → 한 칸).
- 로고(팀 논의 중). 랜딩의 개인정보처리방침·이용약관 페이지와 문의 연락처(마무리 단계).

## Exports

### tokens.css
```css
:root {
  --color-canvas: #F4F6FB;
  --color-paper: #FFFFFF;
  --color-paper-2: #F3F5FA;
  --color-paper-3: #E6EAF2;
  --color-ink: #171C26;
  --color-ink-2: #545D6E;
  --color-muted: #687080;
  --color-rule: #E9ECF2;
  --color-control: #C3CAD6;
  --color-accent: #3B5BDB;
  --color-accent-strong: #2F4AC0;
  --color-accent-soft: #EDF1FF;
  --color-on-accent: #FFFFFF;
  --color-danger: #C92A2A;
  --color-new: #FFE36E;
  --color-check-bg: #FFF2CC;
  --color-check-fg: #7A5000;
  --color-star: #E0A100;
  --color-focus: #3B5BDB;

  --cat-scholarship: #19A974; --cat-scholarship-bg: #E3F6EE; --cat-scholarship-fg: #0B6E49;
  --cat-academic:    #3D7BF7; --cat-academic-bg:    #E6EFFE; --cat-academic-fg:    #1C4FC4;
  --cat-career:      #8B5CF6; --cat-career-bg:      #F0EAFE; --cat-career-fg:      #5B33C6;
  --cat-contest:     #F2994A; --cat-contest-bg:     #FDF0E4; --cat-contest-fg:     #9A4A0C;
  --cat-activity:    #E5579B; --cat-activity-bg:    #FCE8F2; --cat-activity-fg:    #A3245F;

  --font-body: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
  --text-xs: 12px; --text-sm: 13px; --text-base: 14px; --text-md: 15px;
  --text-lg: 16px; --text-xl: 18px; --text-2xl: 20px; --text-3xl: 24px;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-5: 20px; --space-6: 24px; --space-8: 32px;

  --radius-sm: 8px; --radius-md: 12px; --radius-lg: 16px; --radius-pill: 999px;
  --shadow-card: 0 1px 2px rgba(23, 28, 38, .04), 0 4px 16px rgba(23, 28, 38, .04);
  --shadow-pop: 0 12px 36px rgba(23, 28, 38, .16), 0 0 0 1px rgba(23, 28, 38, .06);
  --shadow-fab: 0 8px 20px rgba(59, 91, 219, .35);
  --scrim: rgba(23, 28, 38, .92);

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 150ms;
}
```
