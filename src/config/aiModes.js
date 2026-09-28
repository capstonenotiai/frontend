/**
 * AI 플래너 판단 방식(HOW) 모드 목록.
 *
 * ⚠️ Study / Explorer / Balanced 는 "임시" 모드입니다. (팀에서 재설계 중)
 *    최종 모드가 확정되면 이 배열만 수정하면 Landing / Dashboard / Planner / Settings 에 모두 반영됩니다.
 *    UI 코드에서는 특정 모드 id 를 하드코딩하지 마세요.
 *
 * 필드
 *  - id               : 백엔드와 주고받을 모드 식별자 (user.ai_mode 에 저장되는 값)
 *  - name             : 화면 표시 이름
 *  - shortDescription : Landing 페이지 모드 카드 설명
 *  - description      : AI 플래너 모드 카드 설명
 *  - dashboardHint    : Dashboard AI 미리보기 카드에 붙는 한 줄 안내
 */
export const AI_MODES = [
  {
    id: 'study',
    name: 'Study Mode',
    shortDescription: '학교 공지 위주 필터링',
    description: '학교 공지·학사 일정 중심',
    dashboardHint: '학교 공지를 우선으로 AI가 처리 순서를 추천해 드립니다.',
  },
  {
    id: 'explorer',
    name: 'Explorer Mode',
    shortDescription: '공모전·대외활동 탐색',
    description: 'Wevity·ContestKorea 공모전·대외활동 탐색',
    dashboardHint: '공모전·대외활동을 우선으로 AI가 처리 순서를 추천해 드립니다.',
  },
  {
    id: 'balanced',
    name: 'Balanced Mode',
    shortDescription: '전체 일정 균형 관리',
    description: '전체 일정 균형 분석',
    dashboardHint: '전체 일정을 균형 있게 고려해 AI가 처리 순서를 추천해 드립니다.',
  },
];

/** 사용자 설정이 없을 때 사용할 기본 모드 */
export const DEFAULT_AI_MODE_ID = AI_MODES[0].id;

/** id 로 모드를 찾는다. 없는 id(예: 모드 목록이 바뀐 뒤 저장된 옛 값)면 기본 모드를 돌려준다. */
export function getAiMode(id) {
  return AI_MODES.find((mode) => mode.id === id) ?? AI_MODES.find((mode) => mode.id === DEFAULT_AI_MODE_ID);
}
