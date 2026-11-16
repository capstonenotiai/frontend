# NotiAI — 다중 프롬프트 기반 AI 대학생 일정 자동 생성 시스템

> 충북대학교 소프트웨어학부 졸업작품 · Frontend (React / Vite)

NotiAI는 **학교 공지·공모전·대외활동의 일정을 AI로 추출하고**, 사용자가 일정을 확인·관리하며 Google Calendar에 등록하고 **세 가지 목적별 AI Planner 추천**을 받을 수 있도록 설계한 서비스입니다.

**최종 제출·시연 안내: [docs/EXHIBITION_SUBMISSION.md](docs/EXHIBITION_SUBMISSION.md)**  
**이전 개발 기록: [docs/LEGACY_FRONTEND_README.md](docs/LEGACY_FRONTEND_README.md)**

> 이 README는 GitHub의 `feature/service-v9` 코드를 기준으로 합니다. 기능 구현 코드는 확인했지만 **실제 운영 배포, Google 실계정, 모델 실추론, E2E 성공은 별도 검증 사항**입니다. 배포 화면이 보인다는 것만으로 실API 연동을 확인했다고 볼 수 없습니다.

## 1. 저장소와 구성

| 저장소 | 맡은 역할 | 코드 기준 |
|---|---|---|
| **[Frontend](https://github.com/capstonenotiai/frontend/tree/feature/service-v9)** | React 19 / Vite 8, 반응형 웹 UI, API 클라이언트 | `feature/service-v9` |
| [Backend](https://github.com/capstonenotiai/backend/tree/feature/service-v9) | FastAPI, DB, 수집/자동 실행, Google OAuth·Calendar, Planner | `feature/service-v9` |
| [Model](https://github.com/capstonenotiai/model) | Llama-3.1-8B-Instruct + LoRA v9c, 다중 일정 추출·후처리·평가 | `main` |

```text
충북대 / Wevity / ContestKorea
       ↓
Backend: 크롤러·스케줄러 → 공지 DB → 모델 API(v9c) → 일정 DB
       ↓                                      ↓
Frontend: 대시보드·공지·캘린더·관리자 화면   Google Calendar
       ↓
AI Planner: Backend Facts + GPT 판단 → PRIORITY / DISCOVER / FOCUS
```

크롤러는 **모델 저장소가 아닌 Backend의 `crawler/`**에 있습니다. 실제 모델 서버의 가중치, 수집 원문, 평가 정답 등은 모델 GitHub에 포함되지 않습니다.

## 2. 주요 화면과 기능

- **홈/대시보드**: 일정 및 최근 공지, 다가오는 마감 확인
- **전체 공지**: 검색·필터·상세, 관심 저장/숨김, 사용자별 상태
- **캘린더**: 서비스에서 등록한 일정 조회·관리, Google Calendar API 연동은 Backend 담당
- **AI Planner**: 목적별 추천 결과, 근거·다음 행동/검토 항목 표시
- **알림함, 설정, 신고/피드백, 관리자 검토**
- **반응형 PC·모바일 레이아웃**

세 가지 추천 모드는 버튼 색만 다른 기능이 아닙니다.

| 화면 표시 | API 모드 | 판단 목적 |
|---|---|---|
| 먼저 할 일 | `priority` | 마감·행동 시점·필수 일정 순으로 다음 할 일 판단 |
| 새 기회 | `discover` | 관심분야·프로필·지원 자격에 적합한 기회 평가 |
| 집중할 것 | `focus` | 유사/충돌 활동의 핵심·후순위 선택 |

실제 추천은 **`POST /api/planner/recommendations`**로 요청하며, 모드별 프롬프트/판단/출력 검증은 **Backend `app/services/planner_*.py`**에 구현되어 있습니다. 랜딩 페이지의 Planner 카드는 고정된 **예시 데이터**입니다. 이전 대화형 채팅(`POST /api/planner/chat`)과 구분합니다.

## 3. 실행과 테스트

Node.js **20.19 이상**이 필요합니다.

```bash
npm ci
npm run dev       # Vite 로컬 개발
npm test          # node --test tests/*.test.mjs
npm run build     # dist/ 생성
npm run preview   # 빌드 미리보기
```

실API 테스트는 **백엔드 서버와 그 DB/환경변수가 별도 준비되어 있어야** 합니다. 단순 빌드·유닛 테스트 성공이 외부 API의 실제 연결 성공을 뜻하지 않습니다.

## 4. 프론트 환경변수

`src/config/app.js`와 `.env.example`을 참조하세요.

| 변수 | 설명 |
|---|---|
| `VITE_USE_MOCK` | `false`이면 일정·사용자·캘린더 등 프론트 서비스가 실제 Backend API 호출. 미설정은 Mock |
| `VITE_PLANNER_USE_MOCK` | `false`이면 AI Planner를 실제 추천 API에 연결. 미설정 시 `VITE_USE_MOCK`을 따름 |
| `VITE_API_BASE_URL` | FastAPI 백엔드 기준 URL. 빈 값은 현재 웹 도메인의 `/api/*` 사용 |
| `VITE_MOCK_TODAY` | Mock 시연 데이터의 날짜 기준. 실운영 날짜를 대체하지 않음 |

API 클라이언트는 브라우저에서 `credentials: 'include'`로 세션 쿠키를 전송합니다. 프론트·백엔드의 도메인이 다르면 백엔드 CORS/쿠키/OAuth 리디렉션 설정도 맞아야 합니다.

**보안:** `VITE_*`는 사용자 브라우저 번들에 노출되므로 API 키·OAuth client secret·DB 비밀번호·모델 서버 토큰을 넣지 않습니다.

### Cloudflare Pages 관련

- 빌드 명령: `npm run build` · 출력 경로: `dist`
- 과거 프론트 배포 URL: [notiai.pages.dev](https://notiai.pages.dev) (현재 배포 커밋·실API 연결 여부는 미확인)
- `functions/`는 이전 단계의 Cloudflare Pages Functions 경로를 유지합니다. **최신 추천 API는 별도 Backend FastAPI**에 있으므로 실운영 시 `VITE_API_BASE_URL` 설정을 확인하세요.
- `.env.pages`에는 `VITE_PLANNER_USE_MOCK=false`만 지정되어 있으므로, 이 파일만으로 전체 서비스의 실API 전환을 보장하지 않습니다.
- 실제 Pages 자동 배포가 어떤 브랜치를 사용하는지는 Cloudflare 설정에서 확인해야 합니다. 배포 브랜치를 모르는 상태에서 `main`에 병합하지 않습니다.

## 5. 핵심 폴더

```text
src/pages/          랜딩, 대시보드, 일정, 캘린더, Planner, 설정, 관리자
src/components/     UI 구성 요소, 공지/일정 상세, 모바일 내비게이션
src/services/       API/Mock 전환, Calendar, Planner, 이벤트 등
src/context/        사용자 및 서비스 데이터 상태
src/config/         환경 설정, Planner 모드, 내비게이션
src/styles/         PC/모바일 UI 스타일
functions/          이전 Cloudflare Functions 서버 코드
tests/              UI/서비스 계약 단위 테스트
docs/               진행 기록, 졸업전시회 제출 점검, 구 README 보관
```

## 6. 최종 제출 체크

최종 제출 시에는 [졸업전시회 제출 체크리스트](docs/EXHIBITION_SUBMISSION.md)의 미검증 항목을 실제 시연 결과로 채우고, FE·BE 운영 커밋, 수집/추출 실데이터, Google Calendar 실계정 왕복, Planner 3모드 비교, 테스트 결과를 기록해야 합니다.

**현재 상태 표시의 원칙:** `구현 확인` ≠ `테스트 통과` ≠ `실제 배포 환경에서 시연 성공`. 검증되지 않은 사항은 완료로 표시하지 않습니다.
