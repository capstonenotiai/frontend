# NotiAI Backend Handoff

프론트엔드 작업 중 **AI Planner 테스트를 위해 먼저 구현한 서버/API 부분**을 정리한 문서입니다.

현재 구현 범위는 **Cloudflare Pages Functions 기반 AI Planner API + OpenAI 연결**이며,  
일정 데이터 저장/모델 추론/DB/Google Calendar 등의 메인 백엔드는 아직 구현하지 않았습니다.

---

## 1. 현재 구현된 서버/API

### POST `/api/planner/chat`

**파일**
- `functions/api/planner/chat.js`

**역할**
- 프론트 AI Planner의 사용자 질문을 전달받음
- 서버에서 모드별 system prompt를 선택
- OpenAI Responses API 호출
- 생성된 응답을 프론트에 반환

**Request**

```json
{
  "message": "이번 주에 뭐부터 챙겨야 해?",
  "mode": "study",
  "history": [
    {
      "role": "assistant",
      "content": "이전 응답"
    }
  ]
}
```

**Response**

```json
{
  "reply": "AI 응답"
}
```

현재 허용되는 mode:
- `study`
- `explorer`
- `balanced`

> 위 3개 모드는 **임시 테스트용**입니다.  
> 최종 다중 프롬프트 구조가 확정되면 교체할 예정입니다.

---

### GET `/api/health`

**파일**
- `functions/api/health.js`

**역할**
- Cloudflare Pages Functions 동작 여부 확인
- OpenAI API Key 설정 여부 확인
- 현재 사용할 모델명 확인

`/api/health?check=openai` 사용 시:
- 실제 OpenAI 연결 여부 확인
- API Key 유효성 및 모델 접근 가능 여부 확인

API Key 값 자체는 응답에 노출하지 않습니다.

---

## 2. 서버 내부 구조

### `functions/lib/openai.js`

- OpenAI JavaScript SDK 사용
- OpenAI Responses API 호출
- 기본 모델: `gpt-6-luna`
- `store: false`
- 기본 최대 출력 토큰: 800
- OpenAI 오류 처리
- health check용 OpenAI 연결 확인 함수 포함

### `functions/lib/prompts.js`

- AI Planner system prompt 관리
- 현재 Study / Explorer / Balanced 임시 프롬프트 저장
- 프론트에서 system prompt를 직접 전달하지 않고 **mode id만 전달**
- 최종 모드 확정 후 이 파일 중심으로 교체 가능

### `functions/lib/validation.js`

현재 서버에서 다음 항목을 검증합니다.

- message 필수 여부
- message 길이 제한
- request body 크기 제한
- history 최근 12개 제한
- history 한 항목당 길이 제한
- `user` / `assistant` role만 허용
- 알 수 없는 mode는 기본 mode로 처리
- 현재 user message 중복 전달 방지

---

## 3. 프론트 연결 부분

### `src/services/plannerService.js`

프론트 AI Planner는 다음 API를 호출하도록 연결되어 있습니다.

```
POST /api/planner/chat
```

현재 mock / real API 전환 구조:

```
VITE_PLANNER_USE_MOCK=true
→ mock AI 응답

VITE_PLANNER_USE_MOCK=false
→ 실제 /api/planner/chat 호출
```

따라서 일정/대시보드 등 다른 API가 아직 mock이어도  
**AI Planner만 실제 OpenAI API로 동작**시킬 수 있습니다.

---

## 4. 환경변수

Cloudflare Pages 서버 측:

```
OPENAI_API_KEY
OPENAI_MODEL
OPENAI_MAX_OUTPUT_TOKENS
```

프론트 빌드 측:

```
VITE_PLANNER_USE_MOCK=false
```

주의:
- `OPENAI_API_KEY`는 Cloudflare Secret으로만 관리
- API Key에 `VITE_` prefix를 붙이지 않음
- 프론트 번들에는 OpenAI API Key가 포함되지 않음

---

## 5. 현재 미구현 백엔드

아래 기능은 아직 구현하지 않았습니다.

### 일정/데이터
- 크롤러 결과 저장
- 파인튜닝 LLM 추론 결과 저장
- DB 구조
- `GET /api/events`
- `GET /api/dashboard`

### 사용자
- 사용자 설정 저장
- `GET /api/user/preferences`
- `PUT /api/user/preferences`
- 사용자 인증 / 세션

### Google
- Google OAuth
- Google Calendar 실제 등록
- 일정 등록/삭제 API

예상 형태:

```
POST /api/calendar/register
DELETE /api/calendar/register/:id
```

### AI Planner 고도화
- 실제 일정 데이터를 Planner context에 전달
- 사용자 관심 분야 반영
- Google Calendar 일정 반영
- 최종 다중 프롬프트 모드 로직
- 모드별 추천/우선순위 판단

---

## 6. 현재 AI Planner 구조

현재:

```
React Frontend
    ↓
POST /api/planner/chat
    ↓
Cloudflare Pages Function
    ↓
OpenAI Responses API
    ↓
GPT 응답
```

현재 GPT는 **일반 채팅 연결까지만 완료**된 상태이며,  
아직 실제 NotiAI 일정 데이터나 Google Calendar 데이터를 context로 받지 않습니다.

---

## 7. 메인 백엔드 구축 후 결정할 부분

윤정님이 메인 백엔드를 구축한 이후 AI Planner API는 다음 두 방식 중 하나로 정리할 수 있습니다.

### A. 현재 Cloudflare Function 구조 유지

```
React
 ├─ Main Backend → 모델 / DB / Calendar
 └─ Cloudflare Function → OpenAI Planner
```

### B. AI Planner까지 메인 백엔드로 통합

```
React
  ↓
Main Backend
  ├─ 모델 추론
  ├─ DB
  ├─ Google Calendar
  └─ OpenAI Planner
```

최종 구조는 백엔드 구현 방향에 맞춰 함께 결정하면 됩니다.

프론트 AI Planner의 현재 API 계약은 다음 형태입니다.

```
Request
{ message, mode, history }

Response
{ reply }
```

이 계약을 유지하면 프론트 수정 범위를 최소화하면서 서버 구현을 교체할 수 있습니다.

---

## 8. 관련 파일

```
functions/
  api/
    planner/
      chat.js
    health.js
  lib/
    openai.js
    prompts.js
    validation.js

src/
  services/
    plannerService.js
    apiClient.js
  components/
    ChatPanel.jsx
  config/
    aiModes.js
    app.js
```

---

## 9. 현재 상태 한 줄 요약

> **AI Planner용 서버 API와 OpenAI 연결은 먼저 구현해둔 상태이며, 메인 백엔드의 핵심 작업은 앞으로 모델/크롤러 결과를 저장하고 실제 일정 데이터를 웹과 Planner에 공급하는 부분입니다.**
