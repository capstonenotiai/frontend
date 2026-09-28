# NotiAI — Frontend

> **다중 프롬프트 기반 AI 대학생 일정 자동 생성 시스템**
> 충북대학교 소프트웨어학부 졸업작품

학교 공지 · 장학금 · 공모전 · 대외활동 · 취업/인턴 정보를 자동 수집하고,
파인튜닝된 LLM으로 일정 정보를 구조화한 뒤 Google Calendar와 연동하고,
AI Planner로 개인화된 일정 관리·추천을 제공하는 웹 서비스의 **프론트엔드**입니다.

```
공지/공모전 크롤링 → 파인튜닝 LLM 일정 추출 → 일정 저장/검증
  → 웹에서 일정 확인 → Google Calendar 등록 → AI Planner 추천/질의응답
```

- 모델 · 크롤러: [capstonenotiai/model](https://github.com/capstonenotiai/model) (별도 repository)
- 디자인 기준(Source of Truth): [`reference/NotiAI_web_final.html`](reference/NotiAI_web_final.html)

현재 단계는 **"정적 HTML 프로토타입 → 배포 가능한 React 프론트엔드"** 전환입니다.
백엔드가 없으므로 모든 데이터는 **mock** 이며, `src/services` 만 교체하면 실제 API로 연결되도록 구성했습니다.

---

## 기술 스택

| 구분 | 사용 |
|------|------|
| UI | React 19 (JavaScript) |
| 빌드 | Vite 8 |
| 라우팅 | react-router-dom 7 (URL 기반) |
| 스타일 | 일반 CSS (원본 HTML의 디자인 토큰/클래스 그대로) |

Next.js · Redux · Tailwind · TypeScript · UI 프레임워크는 사용하지 않습니다.

---

## 로컬 실행

Node.js **20.19 이상** (권장 22, `.node-version` 참고)

```bash
npm install
npm run dev        # http://localhost:5173
```

### 빌드 / 미리보기

```bash
npm run build      # dist/ 생성
npm run preview    # 빌드 결과 확인 (http://localhost:4173)
```

### 환경변수 (선택)

`.env.example` 을 `.env.local` 로 복사해서 사용합니다. 기본값만으로도 실행됩니다.

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `VITE_USE_MOCK` | `true` | `false` 면 services 가 실제 API 호출 |
| `VITE_API_BASE_URL` | (빈 값) | 백엔드 주소. 비우면 같은 origin 의 `/api/*` |
| `VITE_MOCK_TODAY` | `2026-05-19` | mock 모드에서 "오늘"로 취급할 날짜 (D-day 기준) |

> ⚠️ `VITE_` 로 시작하는 값은 **브라우저에 그대로 노출**됩니다.
> API Key · OAuth Secret · Google credentials · LLM Key 는 절대 프론트에 넣지 말고 백엔드에서만 관리하세요.
> `.env`, `.env.*` 는 `.gitignore` 로 제외되어 있습니다 (`.env.example` 만 커밋).

---

## Cloudflare Pages 배포

| 항목 | 값 |
|------|-----|
| Framework preset | `React (Vite)` 또는 `None` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` (repository 루트) |
| Node 버전 | `.node-version` 파일(22)을 자동 인식. 필요 시 환경변수 `NODE_VERSION=22` |
| 환경변수 | 없어도 됨 (mock 모드). 백엔드 연결 시 `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=...` |

**SPA 라우팅 (새로고침 404 방지)**
Cloudflare Pages 는 빌드 결과물 최상위에 `404.html` 이 **없으면** 자동으로 SPA 로 판단해
`/dashboard`, `/calendar?month=2026-06` 같은 경로를 직접 열거나 새로고침해도 `index.html` 을 반환합니다.
따라서 `404.html` 이나 `/* /index.html 200` 형태의 `_redirects` 는 추가하지 않았습니다.
(`_redirects` 에 해당 규칙을 넣으면 Cloudflare 가 무한 루프 규칙으로 판단해 무시합니다.)

---

## 화면 / 라우트

| 경로 | 화면 | 원본 HTML |
|------|------|-----------|
| `/` | Landing | `#page-landing` |
| `/dashboard` | 대시보드 | `#view-dashboard` |
| `/schedules` | 일정 목록 | `#view-schedules` |
| `/planner` | AI 플래너 | `#view-planner` |
| `/calendar` | 캘린더 (`?month=YYYY-MM`) | `#view-calendar` |
| `/curation` | 대외활동 큐레이션 | `#view-curation` |
| `/settings` | 설정 | `#view-settings` |

---

## 폴더 구조

```
reference/NotiAI_web_final.html   원본 디자인 (Source of Truth, 삭제 금지)
public/                           favicon 등 정적 파일
src/
  main.jsx, App.jsx               진입점 / 라우팅
  layouts/AppLayout.jsx           사이드바 + 탑바 + 본문
  pages/                          화면 단위 컴포넌트 (Landing, Dashboard, Schedules, Planner, Calendar, Curation, Settings)
  components/                     재사용 UI (Sidebar, Topbar, Card, Badge, EventCard, ModeCard, MonthCalendar, ChatPanel …)
  context/                        공유 상태 (AppDataContext: 일정/등록, UserContext: 사용자/설정)
  services/                       데이터 접근 계층 — mock ↔ 실제 API 전환 지점
  data/                           mock 데이터 (mockEvents, mockUser, mockDashboard, mockPlanner, mockCuration)
  config/                         화면이 따르는 설정 (aiModes, interestCategories, sources, navigation, app)
  hooks/                          useAsync, useCalendarMonth
  utils/                          날짜 · D-day · 달력 계산
  styles/                         원본 CSS 를 영역별로 분리 (base, landing, app, dashboard, …)
```

**규칙**: 컴포넌트에서 `fetch` 를 직접 호출하지 않습니다. 항상 `services/*` → (mock 또는 API) 순서로 접근합니다.

---

## 데이터 모델

### Event

[model repository](https://github.com/capstonenotiai/model) 의 추출 결과(5필드)와 크롤러 메타데이터를 기준으로 합니다.

```js
{
  // ── LLM 추출 결과 (model repo src/config.py SYSTEM_PROMPT) ──
  title: '2026 충북대학교 창업경진대회',
  start_date: '2026-05-01',   // 'YYYY-MM-DD' 또는 '' (본문에 시작일이 없으면 빈 문자열)
  end_date: '2026-05-22',     // 'YYYY-MM-DD' 또는 ''
  location: '충북대학교 개신문화관', // 없거나 온라인 접수뿐이면 '', 온라인 행사면 '온라인'
  detail: '재학생 팀 대상, …',  // 보조정보 120자 이내

  // ── 크롤러 메타 (crawler/*.py) ──
  source: 'cbnu',             // 'cbnu' | 'wevity' | 'contestkorea' (크롤러의 site 값)
  source_url: 'https://…',

  // ── 서비스 필드 ──
  id: 'ev1',
  category: 'contest',        // config/interestCategories.js 의 id
  is_new: false,
  registered: true,           // Google Calendar 등록 여부
  bookmarked: false,
  collected_at: '2026-05-12T09:00:00+09:00',
  review_status: 'auto',      // 'auto' | 'needs_review' (model repo cascade_infer.py 의 auto_register_status)
}
```

- `services/eventService.js` 의 `normalizeEvent()` 가 서버 응답을 위 형태로 맞춥니다. (크롤러의 `site`, `title_raw` 필드도 허용)
- 화면에서는 `start_date` / `location` 이 `''` 인 경우를 모두 처리합니다. (예: `~ 2026-05-22`)
- D-day · 임박도(`hot`/`warm`/`cool`/`far`) 는 저장하지 않고 `utils/events.js` 에서 계산합니다.

### User

```js
// 기본 정보 (향후 GET /api/user)
profile = { name: '김학생', email: 'student@cbnu.ac.kr' }

// 설정 (향후 GET/PUT /api/user/preferences)
preferences = {
  ai_mode: 'study',          // config/aiModes.js 의 id
  interests: [],             // config/interestCategories.js 의 id 배열
  enabled_sources: { cbnu: true, wevity: true, contestkorea: true },
  notifications: { d7: true, d3: true, new_event: false },
  auto_mode_recommend: true,
}
```

`interests`, `ai_mode` 의 최종 저장 방식은 아직 미정입니다.

---

## AI 모드 / 관심 분야 (재설계 중)

- **판단 방식(HOW)** — `src/config/aiModes.js`
  현재 Study / Explorer / Balanced 는 **임시** 모드입니다. 이 배열만 수정하면
  Landing · Dashboard · AI 플래너 · 설정 화면에 모두 반영됩니다. 화면 코드에 모드 id 를 하드코딩하지 않았습니다.
  모드별 첫 인사 문구는 `src/data/mockPlanner.js` (없는 모드는 기본 문구 사용).
- **관심 분야(WHAT)** — `src/config/interestCategories.js`
  장학/지원 · 학사/교육 · 취업/인턴 · 공모전 · 대외활동. 선택 UI(`components/InterestSelector.jsx`)는 만들어 두었고,
  `src/config/app.js` 의 `FEATURE_FLAGS.interestSettings = true` 로 바꾸면 설정 화면에 나타납니다.

---

## 현재 mock 으로 동작하는 기능

| 기능 | 현재 동작 | 연결 예정 |
|------|-----------|-----------|
| 일정 목록 | `data/mockEvents.js` 6건 | `GET /api/events` |
| 대시보드 수집 현황 | `data/mockDashboard.js` | `GET /api/dashboard` |
| 캘린더 등록/해제 | `registered` 값만 변경 (화면 즉시 반영) | `POST /api/calendar/register`, `DELETE /api/calendar/register/:id` → 백엔드가 Google Calendar API 호출 |
| 전체 등록 | 미등록 일정 일괄 `registered = true` | 위 API 반복 또는 일괄 API |
| 북마크 | 화면/mock 상태만 변경 | 엔드포인트 미정 |
| AI 플래너 대화 | 키워드 기반 임시 응답 (0.7초 지연). `/error` 가 포함된 메시지는 에러 상태 확인용 | `POST /api/planner/chat` (백엔드에서 모드별 프롬프트로 LLM 호출) |
| 7일 브리핑 / AI 액션 제안 | `data/mockPlanner.js` 고정 값 | 미정 |
| 사용자 · 설정 | `data/mockUser.js`, 저장 시 mock 저장소 갱신 | `GET/PUT /api/user/preferences` |
| 대외활동 큐레이션 | `data/mockCuration.js` 스냅샷 | 부트캠프 서비스 API |
| Google 로그인 | 버튼 클릭 시 대시보드로 이동만 | Google OAuth (백엔드) |

mock 상태(`services/mockStore.js`)는 탑바 '새로고침' 후에도 유지되지만, 브라우저 새로고침 시 초기화됩니다.

**LLM API(OpenAI / Claude / Gemini 등)를 프론트에서 직접 호출하지 않습니다.** 반드시 백엔드 endpoint 를 통해 연결합니다.

### 실제 API 로 전환하는 방법

1. `.env.local` 에 `VITE_USE_MOCK=false`, `VITE_API_BASE_URL=https://…`
2. `src/services/*.js` 의 `apiRequest(...)` 경로/요청 body 를 실제 명세에 맞게 수정
3. 응답 형태가 다르면 `normalizeEvent()` 등 service 의 변환 함수만 수정 (화면 코드는 그대로)

---

## 앞으로 연결할 기능

- [ ] 백엔드 API 명세 확정 후 `services` 실제 호출로 교체
- [ ] model repo 추출 결과(`final_prediction`, `auto_register_status`) 저장 파이프라인과 `GET /api/events` 연결
- [ ] `needs_review` 일정 검토 UI (자동 등록 vs 검토 후 등록)
- [ ] Google OAuth 로그인 / Google Calendar 실제 등록 (백엔드)
- [ ] AI 플래너 다중 프롬프트 모드 최종 확정 → `config/aiModes.js` 교체, `POST /api/planner/chat` 연결
- [ ] 관심 분야(WHAT) 설정 / 온보딩 노출
- [ ] 캘린더 주/일 보기, 7일 브리핑 주 이동, 일정 직접 추가
- [ ] 반응형(모바일) 레이아웃
