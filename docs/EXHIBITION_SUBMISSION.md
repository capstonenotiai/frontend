# NotiAI · 졸업전시회 코드/시연 제출 점검

> 기준: 2026-11-17 · 대상: `frontend/feature/service-v9`(6c076b9a66f1), `backend/feature/service-v9`(763abe5c260c), `model/main`(a0205c3d7ed3). **코드 정적 검토 결과**이며, 운영 환경에 접속하거나 E2E 테스트에 성공했다는 뜻이 아닙니다.

## 1. 프로젝트 소개

**다중 프롬프트 기반 AI 대학생 일정 자동 생성 시스템** NotiAI는 충북대·공모전/대외활동 공지 내용을 수집하고, Llama-3.1-8B-Instruct + LoRA(v9c) 추출 모델로 학생의 신청·제출·행사·면접 일정을 구조화합니다. 사용자는 React 반응형 웹에서 공지·일정을 확인하고, Google Calendar 등록과 개인화 AI Planner 추천을 사용할 수 있도록 설계되었습니다.

```text
CBNU / Wevity / ContestKorea → 수집·중복 검사 → DB notices
  → 추출 모델(model API) → 검증·DB events → FastAPI
  → React 웹(공지/일정/캘린더) → Google Calendar API
                                ↘ 사용자·공지 Facts → 3모드 AI Planner
```

## 2. 3개 공식 저장소

| 저장소 | 역할 | 최종 개발 기준 |
|---|---|---|
| [frontend](https://github.com/capstonenotiai/frontend/tree/feature/service-v9) | React 19, Vite, 반응형 화면, API 클라이언트 | `feature/service-v9` |
| [backend](https://github.com/capstonenotiai/backend/tree/feature/service-v9) | FastAPI, DB, 크롤러, 스케줄러, Google OAuth/Calendar, 추천 API | `feature/service-v9` |
| [model](https://github.com/capstonenotiai/model) | 일정 추출 v9c, 추론 API, 학습·평가·후처리 | `main` |

프론트·백엔드의 `main`은 위 개발 브랜치보다 이전 버전입니다. **기존 배포가 어떤 브랜치/커밋으로 만들어졌는지 확인한 뒤에만** 운영 브랜치를 변경해야 합니다.

## 3. 주요 기능 및 확인 수준

| 기능 | 코드 위치/현황 | 현장 시연 전 확인 |
|---|---|---|
| 공지 수집 | backend/`crawler/{cbnu,wevity,contestkorea,runner}.py`; 중복 검사 | 최신 공지 실수집, 사이트별 오류 로그 |
| 정기 수집 및 추출 | backend/`app/scheduler.py`, `app/services/pipeline.py` | `CRAWL_ENABLED`, 실행 결과 및 모델 API 상태 |
| 다중 일정 추출 | model v9c `/extract`; backend `ModelApiExtractor` | `EXTRACTOR=model_api`, 서버 실추론 |
| 공지/일정 웹 | frontend `src/pages/`, `src/services/` | 실API 응답, 모바일, 날짜/검색 |
| Google 로그인/등록 | backend `app/routers/auth.py`, `calendar.py` | 실계정 OAuth 및 Google 캘린더에서 일정 확인 |
| AI Planner 3모드 | backend `planner_context.py`, `planner_prompts.py`, `planner_validation.py` | 실데이터 추천 판단·근거 품질 |

**중요**: 화면 표시/코드 존재만으로 실서비스 동작을 인증하지 않습니다. 프론트는 `VITE_USE_MOCK=false` 및 백엔드 API 주소가 설정되어야 실데이터를 사용합니다. 백엔드는 기본값이 `EXTRACTOR=stub`, `CRAWL_ENABLED=false`, `DEV_LOGIN=true`이며, 운영 설정은 여기서 확인할 수 없습니다. 개발 로그인에서 일정 등록이 성공한 것처럼 보이더라도 실제 Google Calendar에 쓰지 않을 수 있습니다.

## 4. AI Planner 세 모드

- **PRIORITY** (`priority`, 먼저 할 일): 서버에서 정한 마감·필수 여부·행동 시점의 우선순위를 설명하고 다음 행동을 제안합니다.
- **DISCOVER** (`discover`, 새 기회): 프로필·관심분야·자격 확인 근거를 바탕으로 적극/검토/비추천을 판단합니다.
- **FOCUS** (`focus`, 집중할 것): 유사 활동·검증된 일정 충돌을 비교해 핵심/후순위와 이유를 제시합니다.

실제 추천 API는 backend `POST /api/planner/recommendations`입니다. 랜딩 화면의 Planner 미리보기는 **고정 예시**이며 실제 AI 응답의 검증 근거가 아닙니다. 이전 `/api/planner/chat` 자유형 대화와 3모드 추천을 혼동하지 마세요.

## 5. 모델 평가 (모델 저장소에 명시된 결과)

v9c 독립 평가셋은 100건 수집·15건 제외 후 **85개 공지/141개 일정**입니다. 공지 완벽 일치 **61.2%(52/85)**, 일정 재현율 **83.7%**, 정밀도 **91.5%**, 날짜 정확도 **95.8%**, 접수 마감일 정확도 **96.5%**입니다. 지표의 정의·한계는 [모델 문서](https://github.com/capstonenotiai/model/blob/main/README.md)를 참고합니다. 다른 시기의 데이터셋/평가 기준과 직접 비교하지 않습니다.

## 6. 로컬 개발/검증

**Frontend** (Node.js 20.19+):

```bash
npm ci
npm test
npm run build
npm run dev
```

**Backend** (Python, 종속성/DB를 개발 환경에 맞게 설정):

```bash
python -m pip install -r requirements.txt
pytest
# 실제 백엔드 실행 및 DB 연결 방법: backend/README.md
```

**Model** (해당 저장소의 Python/GPU 실행 환경과 로컬 가중치 필요):

```bash
python -m pip install -r requirements.txt
pytest
```

위 명령은 **검증 절차 안내**이며 이 문서 작성 과정에서 실행한 테스트 성공 로그는 아닙니다. 서버 공개 접속 시에는 비밀정보를 포함한 `.env`나 API 키를 GitHub에 올리지 마세요.

## 7. 졸업전시회 제출 완료 조건

- [ ] 실제 배포 **프론트 URL / 백엔드 API URL / 모델 서버 운용 위치 / 기준 커밋 SHA** 기록 (비밀 토큰·내부 URL은 비공개)
- [ ] 최신 공지 1건을 실제 수집하여 DB notices→model API→events까지 확인
- [ ] 프론트 실데이터 확인 (`VITE_USE_MOCK=false`, `VITE_PLANNER_USE_MOCK=false`, `VITE_API_BASE_URL` 확인)
- [ ] 실제 Google 로그인→일정 등록→Google Calendar 직접 확인→수정/해제까지 왕복 검증
- [ ] 같은 사용자·공지 기준 PRIORITY/DISCOVER/FOCUS 각각 실행하고 목적·이유·근거를 점검
- [ ] 최신 코드에서 FE `npm test`, `npm run build`, BE `pytest`, 모델 `pytest` 실행 결과 기록
- [ ] PC·모바일 핵심 화면, 에러 시 대처, 시연용 백업 자료 점검
- [ ] 전시 직전 배포 브랜치/커밋 동결 및 발표 자료·시연 내용과 일치 확인

## 8. 제출 전 정리가 필요한 사항 / 변경 정책

1. FE·BE 기존 README에는 과거 Mock/미구현 안내가 남아 있어 **현행 문서와 불일치**합니다. 이 문서를 최신 기능 인덱스로 사용하고, 기존 문서는 신중히 수정합니다.
2. `feature/service-v9` 미병합 상태입니다. **배포 소스와 CI/검증 결과 확인 없이 `main`에 병합하지 않습니다.**
3. Wevity 크롤러의 고정 게시글 번호 fallback(`105566`)과 요청 실패 판정은 실사이트 재현 후 **해당 부분만** 수정합니다. 예전 크롤러 전체를 덮어쓰지 않습니다.
4. AI Planner 프롬프트(`planner-v7`)는 실제 3모드 결과를 비교한 뒤 재현된 문제만 수정합니다. 모델 재학습이나 전면 교체는 현 시점의 확정 작업이 아닙니다.
5. 모델 저장소에 공개되지 않은 가중치·원문 데이터/평가 정답은 **임의로 업로드하지 않습니다**. 복구 가능한 보관 위치/인수인계 여부는 별도 점검합니다.
6. 이 문서는 확인된 구현과 **운영 확인 필요 항목을 명시적으로 분리**합니다. 실제 접속·OAuth·실모델·자동 크롤링이 검증되기 전까지 '전체 시연 성공'이라고 쓰지 않습니다.

---
작성 범위: GitHub 정적 검토 기반의 최종 제출 인덱스. 운영 배포/실기능 E2E는 별도 인증 필요.
