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
| 서버 | Cloudflare Pages Functions (`functions/`) + OpenAI JavaScript SDK (Responses API) |

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
| `VITE_USE_MOCK` | `true` | `false` 면 **모든** services 가 실제 API 호출 (일정 API 등이 아직 없으므로 지금은 `true` 유지) |
| `VITE_PLANNER_USE_MOCK` | (`VITE_USE_MOCK` 을 따름) | `false` 면 **AI 플래너만** 실제 `POST /api/planner/chat` → OpenAI 호출 |
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
functions/                        Cloudflare Pages Functions (서버 측 코드, 브라우저 번들에 포함되지 않음)
  api/planner/chat.js             POST /api/planner/chat
  api/health.js                   GET /api/health (서버·OpenAI 설정 확인)
  lib/openai.js                   OpenAI Responses API 호출
  lib/prompts.js                  AI 플래너 system prompt (TEMPORARY 모드 프롬프트)
  lib/validation.js               요청 검증 (message / mode / history 제한)
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
| AI 플래너 대화 | **실제 연결 완료** (`VITE_PLANNER_USE_MOCK=false` 일 때 OpenAI). mock 일 때는 키워드 기반 임시 응답, `/error` 포함 시 에러 상태 확인용 | 일정 데이터를 대화 context 로 추가 (예정) |
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

## AI 플래너 — OpenAI 실제 연결

```
React ChatPanel → services/plannerService.js
  → POST /api/planner/chat  (functions/api/planner/chat.js, Cloudflare 서버)
  → OpenAI Responses API (functions/lib/openai.js)
  → { reply } → ChatPanel 에 표시
```

- OpenAI 호출은 **Cloudflare 서버 측에서만** 실행됩니다. 브라우저는 OpenAI 를 직접 호출하지 않고, API Key 도 볼 수 없습니다.
- system prompt 는 서버(`functions/lib/prompts.js`)에서만 관리합니다. 프론트는 모드 id(`study`/`explorer`/`balanced`)만 보냅니다.
  Study / Explorer / Balanced 프롬프트는 **임시(TEMPORARY)** 이며, 이 파일만 교체하면 됩니다.
- 옵션: `store: false`, `max_output_tokens: 800` (환경변수 `OPENAI_MAX_OUTPUT_TOKENS` 로 변경 가능), 스트리밍 없음.

### API 계약

```jsonc
// POST /api/planner/chat
{
  "message": "이번 주에 뭐부터 챙겨야 해?",   // 이번 사용자 메시지 (1~3000자)
  "mode": "study",                          // 모르는 값이면 서버가 study 로 처리
  "history": [                              // "이전" 대화만 (현재 message 는 포함하지 않음)
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "..." }
  ]
}
// 200 → { "reply": "..." }
// 400 (빈 메시지·형식 오류·3000자 초과) / 405 (POST 외) / 413 (본문 64KB 초과)
// 500 (서버 설정 누락) / 502 (OpenAI 오류) / 503 (OpenAI 요청 한도 초과) → { "message": "..." }
```

서버 검증: `history` 는 최근 12개만, 각 2000자까지 사용. `user` / `assistant` 외의 role(system, developer 등)은 무시합니다.

### Cloudflare Pages 설정 (Dashboard)

프로젝트 → **Settings → Variables and Secrets** (Production, 필요하면 Preview 에도 동일하게)

| 종류 | 이름 | 값 | 용도 |
|------|------|-----|------|
| **Secret** | `OPENAI_API_KEY` | OpenAI API Key | 서버(Functions) 전용 |
| Variable | `OPENAI_MODEL` | `gpt-6-luna` | 선택. 비우면 기본값 `gpt-6-luna` |
| Variable | `OPENAI_MAX_OUTPUT_TOKENS` | `800` | 선택 |
| Variable (빌드용) | `VITE_PLANNER_USE_MOCK` | `false` | 프론트 빌드 시 AI 플래너를 실제 API 로 전환 |

> ⚠️ `OPENAI_API_KEY` 에는 **절대 `VITE_` 접두사를 붙이지 마세요.** `VITE_` 값은 브라우저 번들에 그대로 들어갑니다.
>
> 💡 `VITE_USE_MOCK=false` 를 쓰면 AI 플래너뿐 아니라 일정·대시보드·설정까지 실제 API(`/api/events` 등, 아직 없음)를 호출해 화면이 비게 됩니다.
> 지금은 **`VITE_PLANNER_USE_MOCK=false` 만** 설정하세요. 다른 API 가 생기면 그때 `VITE_USE_MOCK=false` 로 바꾸면 됩니다.

`VITE_*` 는 **빌드할 때** 들어가는 값이므로, 설정 후 **Deployments → 최신 배포 → Retry deployment**(또는 새 push)로 다시 빌드해야 적용됩니다.
`OPENAI_*` 는 서버 런타임 값이라 재배포 후 바로 적용됩니다.

### 로컬 테스트 (Pages Functions 포함)

`npm run dev`(vite) 만으로는 `functions/` 가 실행되지 않습니다. Wrangler 로 Cloudflare Pages 환경을 로컬에서 띄웁니다.

```bash
cp .dev.vars.example .dev.vars    # 로컬 서버 비밀값 (git 에 올라가지 않음)
# .dev.vars 에 OPENAI_API_KEY=sk-... 입력

npm run pages:dev                 # vite build --mode pages → wrangler pages dev dist (http://localhost:8788)
```

- `--mode pages` 는 `.env.pages`(`VITE_PLANNER_USE_MOCK=false`, 공개 값만)를 읽어 AI 플래너만 실제 API 로 빌드합니다.
- 화면을 고치면서 테스트하려면: 터미널 1 `npm run pages:dev`, 터미널 2 `npx vite --mode pages` (Windows 포함 공통)
  → vite(5173)가 `/api/*` 요청을 8788 로 전달합니다 (`vite.config.js` proxy).
- API 만 확인:
  ```bash
  curl -X POST http://localhost:8788/api/planner/chat \
    -H 'Content-Type: application/json' \
    -d '{"message":"이번 주에 뭐부터 챙겨야 해?","mode":"study","history":[]}'
  ```

### 배포 후 확인

**0. 서버 상태 확인 (health)**

| 링크 | 확인 내용 |
|------|-----------|
| https://notiai.pages.dev/api/health | Functions 동작 여부, `OPENAI_API_KEY` 설정 여부(true/false), 사용할 모델명 — OpenAI 호출 없음 |
| https://notiai.pages.dev/api/health?check=openai | 실제로 OpenAI 에 연결해 Key 유효성 + 모델 사용 가능 여부 확인 (모델 조회만 하므로 토큰 비용 없음) |

정상이면 `"status": "ok"`, 문제가 있으면 `"status": "degraded"` 와 `reason` 이 표시됩니다. Key 값은 응답에 절대 포함되지 않습니다.


1. `https://notiai.pages.dev/planner` 에서 메시지 전송 → 실제 GPT 응답 표시
2. 실패하면 Cloudflare Dashboard → 프로젝트 → **Deployments → 해당 배포 → Functions 로그(Real-time Logs)** 에서
   `[planner/chat]` 로그 확인 (status/code 만 기록, Key·원문 오류는 기록하지 않음)
   - `AI 플래너 서버 설정이 완료되지 않았습니다.` → `OPENAI_API_KEY` Secret 누락
   - `AI 응답 생성에 실패했습니다.` → Key 오류, 모델 이름(`OPENAI_MODEL`) 오류, 크레딧 부족 등
3. 여전히 mock 응답("데모(mock) 응답")이 나오면 `VITE_PLANNER_USE_MOCK=false` 설정 후 재빌드했는지 확인

---

## 앞으로 연결할 기능

- [ ] 백엔드 API 명세 확정 후 `services` 실제 호출로 교체
- [ ] model repo 추출 결과(`final_prediction`, `auto_register_status`) 저장 파이프라인과 `GET /api/events` 연결
- [ ] `needs_review` 일정 검토 UI (자동 등록 vs 검토 후 등록)
- [ ] Google OAuth 로그인 / Google Calendar 실제 등록 (백엔드)
- [x] AI 플래너 `POST /api/planner/chat` → OpenAI 실제 연결 (단순 채팅)
- [ ] AI 플래너에 일정 데이터를 대화 context 로 추가
- [ ] 다중 프롬프트 모드 최종 확정 → `config/aiModes.js` + `functions/lib/prompts.js` 교체
- [ ] 관심 분야(WHAT) 설정 / 온보딩 노출
- [ ] 캘린더 주/일 보기, 7일 브리핑 주 이동, 일정 직접 추가
- [ ] 반응형(모바일) 레이아웃
