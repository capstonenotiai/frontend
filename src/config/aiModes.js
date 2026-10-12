/** 백엔드 추천 모드. 플래너 선택은 사용자 기본 설정과 독립적이다. */
export const AI_MODES = [
  { id: 'priority', name: '먼저 할 일', question: '지금 무엇부터 처리할까?', criteria: ['마감이 급한 일정', '공지에 필수로 적힌 일정', '지금 신청할 수 있는 일정'], labels: ['지금 진행', '미리 준비', '확인 필요', '추후 확인'], shortDescription: '지금 처리할 일정 정리', description: '내 일정의 다음 행동을 정리해요.', dashboardHint: '지금 처리할 일을 추천해 드려요.' },
  { id: 'discover', name: '새 기회', question: '나에게 맞는 새 기회는?', criteria: ['관심분야와 맞거나 관련된 기회', '전공, 학년, 재학 조건이 맞는 공지'], labels: ['적극 추천', '검토 추천', '추천 안 함'], shortDescription: '나에게 맞는 기회 탐색', description: '프로필과 관심분야에 맞는 기회를 찾아요.', dashboardHint: '나에게 맞는 새 기회를 추천해 드려요.' },
  { id: 'focus', name: '집중할 것', question: '무엇에 집중하고 무엇을 미룰까?', criteria: ['비슷한 활동끼리 비교', '날짜가 겹치는 일정끼리 비교'], labels: ['핵심', '후순위'], shortDescription: '집중할 일정 비교', description: '비슷하거나 겹치는 일정의 우선순위를 정해요.', dashboardHint: '먼저 집중할 일정을 추천해 드려요.' },
];
export const DEFAULT_AI_MODE_ID = 'priority';
export function getAiMode(id) { return AI_MODES.find((mode) => mode.id === id) ?? AI_MODES[0]; }
