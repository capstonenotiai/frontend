/**
 * AI 플래너 mock 데이터.
 * 실제로는 백엔드(POST /api/planner/chat 등)가 모드별 프롬프트로 생성할 내용입니다.
 *
 * 메시지 content 형식: 문단 문자열 배열. **굵게** 표기만 지원 (components/RichText.jsx)
 * — HTML 을 그대로 넣지 않으므로 LLM 응답을 붙여도 XSS 위험이 없습니다.
 */

/** 모드별 첫 인사. 여기에 없는 모드는 plannerService 의 기본 인사를 사용 */
export const mockGreetings = {
  study: [
    '안녕하세요! Study Mode로 설정되어 있어요.',
    '현재 수집된 일정 중 **CBNU 포털 공지 11건**을 분석했습니다. 학교 관련 마감 2건 중 **D-3 창업경진대회**가 가장 급합니다.',
    '무엇이 궁금하신가요?',
  ],
  explorer: [
    '안녕하세요! Explorer Mode로 설정되어 있어요.',
    'Wevity·ContestKorea에서 수집된 공모전 12건을 분석했습니다. 상금 규모가 큰 **K-스타트업 그랜드챌린지**와 마감이 임박한 **광고대상(D-6)**을 우선 추천드려요.',
    '무엇이 궁금하신가요?',
  ],
  balanced: [
    '안녕하세요! Balanced Mode로 설정되어 있어요.',
    '전체 소스(CBNU·Wevity·ContestKorea)의 일정 23건을 균형 있게 분석했습니다. 마감 임박도와 카테고리를 고르게 반영해 우선순위를 정리했어요.',
    '무엇이 궁금하신가요?',
  ],
};

/** 7일 브리핑 */
export const mockWeeklyBriefing = {
  rangeLabel: '5/19 — 5/25',
  items: [
    {
      dateLabel: '5월 22일 (금)',
      urgency: 'hot',
      title: '창업경진대회 — 마감',
      tags: [
        { label: 'CBNU', tone: 'blue' },
        { label: 'D-3', tone: 'red' },
      ],
    },
    { dateLabel: '5월 23일 (토) – 24일 (일)', urgency: 'empty', title: '', tags: [] },
    {
      dateLabel: '5월 25일 (월)',
      urgency: 'warm',
      title: '광고대상 마감',
      tags: [
        { label: 'Wevity', tone: 'blue' },
        { label: 'D-6', tone: 'amber' },
      ],
    },
    {
      dateLabel: '그 이후',
      urgency: 'cool',
      title: 'SW 해커톤 외 3건',
      tags: [
        { label: 'CBNU', tone: 'blue' },
        { label: 'D-11~', tone: 'gray' },
      ],
    },
  ],
};

/** AI 액션 제안 */
export const mockActionSuggestions = [
  { id: 'a1', tone: 'red', text: '창업경진대회 신청서를 지금 작성하세요' },
  { id: 'a2', tone: 'amber', text: '광고대상 작품 파일을 최종 점검하세요' },
  { id: 'a3', tone: 'blue', text: '미등록 일정 3건을 캘린더에 등록하세요' },
];
