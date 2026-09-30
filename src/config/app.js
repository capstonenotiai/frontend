/**
 * 앱 전역 설정.
 * 환경변수는 .env.example 참고. (VITE_ 접두사 값은 브라우저에 노출되므로 비밀값 금지)
 */

/** true 면 services 가 mock 데이터를 반환, false 면 실제 API 호출 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

/**
 * AI 플래너만 따로 mock / 실제 API 를 전환.
 * 다른 API(/api/events 등)가 아직 없으므로, 실제 GPT 연결은 VITE_PLANNER_USE_MOCK=false 로 켠다.
 * 값이 없으면 VITE_USE_MOCK 을 따른다.
 */
export const PLANNER_USE_MOCK =
  import.meta.env.VITE_PLANNER_USE_MOCK === undefined || import.meta.env.VITE_PLANNER_USE_MOCK === ''
    ? USE_MOCK
    : import.meta.env.VITE_PLANNER_USE_MOCK !== 'false';

/** 백엔드 API base URL. 비워두면 같은 origin 의 /api/* 로 요청 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

/**
 * mock 모드에서 "오늘"로 취급하는 날짜.
 * mock 일정이 2026년 5월 기준이라 D-day 가 디자인 시안과 같게 나오도록 고정.
 */
export const MOCK_TODAY = import.meta.env.VITE_MOCK_TODAY || '2026-05-19';

/** mock 응답 지연(ms) — loading 상태 확인용 */
export const MOCK_LATENCY_MS = 0;
export const MOCK_CHAT_LATENCY_MS = 700;

export const GITHUB_URL = 'https://github.com/capstonenotiai';

/** AI 플래너 헤더 표시 정보 (백엔드 연결 후 실제 모델 정보로 교체) */
export const PLANNER_ASSISTANT = {
  name: 'AI 플래너',
  subtitle: 'GPT-4o-mini · 모드별 시스템 프롬프트',
  avatar: 'N',
};

/** 마감 임박 기준 (D-day 계산) */
export const URGENCY_DAYS = {
  hot: 3, // D-3 이내
  warm: 7, // D-7 이내
  cool: 14, // D-14 이내
};

/** 아직 UI 에 노출하지 않는 기능 스위치 */
export const FEATURE_FLAGS = {
  /** Settings 에 관심 분야(WHAT) 선택 카드 노출 */
  interestSettings: false,
};
