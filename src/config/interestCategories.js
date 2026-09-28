/**
 * 사용자 관심 분야(WHAT) 목록 — 복수 선택.
 *
 * 아직 최종 UI 에는 노출되지 않습니다. (config/app.js 의 FEATURE_FLAGS.interestSettings)
 * 저장 형태는 user.interests = ['scholarship', 'contest', ...] 처럼 id 배열로 가정합니다.
 *
 * - boards  : 참고용. model repo crawler/cbnu.py 의 EXTRA_BOARDS 키와 매핑 가능한 게시판
 */
export const INTEREST_CATEGORIES = [
  { id: 'scholarship', label: '장학/지원', boards: ['scholarship'] },
  { id: 'academic', label: '학사/교육', boards: ['sw_notice'] },
  { id: 'career', label: '취업/인턴', boards: ['employment'] },
  { id: 'contest', label: '공모전', boards: [] },
  { id: 'activity', label: '대외활동', boards: [] },
];

export function getInterestCategory(id) {
  return INTEREST_CATEGORIES.find((category) => category.id === id);
}
