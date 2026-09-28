/**
 * 대외활동 큐레이션 mock — 부트캠프(Cloud·데이터·AI 파이프라인) 프로젝트 결과 스냅샷.
 * 향후 실제 API 로 교체 예정. 수치는 reference/NotiAI_web_final.html 과 동일.
 */
export const mockCuration = {
  header: {
    stackLabel: 'OCI Compute · Oracle DB · Node.js API',
    updateLabel: '매일 00:10 자동 업데이트',
  },
  stats: [
    { label: '전체 활동', value: '432', change: 'ContestKorea + Wevity', tone: 'neutral' },
    { label: '7일 이내 마감', value: '80', change: '지금 확인 필요', tone: 'warn' },
    { label: '오늘 마감', value: '18', change: '긴급', tone: 'warn' },
    { label: '시상 규모 최대', value: '8,300만', change: '평균 689만', tone: 'neutral' },
  ],
  recommendationBasis: '임박도 · 시상규모 순위합산 기반',
  recommendations: [
    {
      id: 'r1',
      category: '공모전',
      categoryTone: 'blue',
      title: '2026년 전주MBC K-하이테크 플랫폼 제2회 가상현실 공간 창작 공모전',
      rankLabel: '임박도 상위 11% · 시상 상위 8%',
      daysLeft: 2,
      prize: '1,100만원',
    },
    {
      id: 'r2',
      category: '기타',
      categoryTone: 'amber',
      title: 'Korea Clean Challenge 제1회 코리아 클린 챌린지',
      rankLabel: '임박도 상위 22% · 시상 상위 6%',
      daysLeft: 5,
      prize: '1,000만원',
    },
    {
      id: 'r3',
      category: '인턴십',
      categoryTone: 'green',
      title: '넥슨 영 프로그래머스 컵 (NEXON Young Programmers Cup)',
      rankLabel: '임박도 상위 29% · 시상 상위 1%',
      daysLeft: 7,
      prize: '5,000만원',
    },
  ],
  /** 분야별 분포 (도넛 차트) */
  categoryDistribution: [
    { label: '공모전', count: 320, color: '#2563EB' },
    { label: '기타', count: 60, color: '#9CA3AF' },
    { label: '서포터즈', count: 20, color: '#16A34A' },
    { label: '인턴십', count: 15, color: '#7C3AED' },
    { label: '해커톤', count: 17, color: '#F59E0B' },
  ],
  /** 사이트 × 분야별 분포. barWidths 는 원본 시안의 막대 길이(%) 그대로 */
  siteDistribution: {
    sites: [
      { id: 'contestkorea', label: 'ContestKorea', color: '#2563EB' },
      { id: 'wevity', label: 'Wevity', color: '#93C5FD' },
    ],
    rows: [
      { label: '공모전', counts: [198, 122], barWidths: [61.1, 37.7] },
      { label: '기타', counts: [30, 30], barWidths: [34.7, 34.7] },
      { label: '인턴십', counts: [5, 10], barWidths: [5.8, 11.6] },
      { label: '해커톤', counts: [4, 3], barWidths: [4.6, 3.5] },
      { label: '서포터즈', counts: [8, 22], barWidths: [9.3, 25.6] },
    ],
  },
  /** 마감 임박 TOP 5 (days_left 오름차순) */
  deadlineTop5: [
    { id: 't1', title: '쥬크박스 뮤지컬 [쇼 머스트 고 온 in 대학로] 전례역 오디션', category: '공모전', categoryTone: 'blue', daysLeft: 0 },
    { id: 't2', title: '2026 경운대학교 총장배 데이터톤 경진대회', category: '기타', categoryTone: 'gray', daysLeft: 0 },
    { id: 't3', title: '제3회 한남대학교 청소년 찬양축제 (H&U Worship Festival)', category: '공모전', categoryTone: 'blue', daysLeft: 0 },
    { id: 't4', title: '2026 글로벌 청소년 콘텐츠 경진대회 AI영상 부문', category: '공모전', categoryTone: 'blue', daysLeft: 0 },
    { id: 't5', title: '뮤지컬 [엄마마투리] 배우 모집', category: '공모전', categoryTone: 'blue', daysLeft: 0 },
  ],
  footnote: {
    text: '하계 Cloud·데이터·AI 파이프라인 구축 부트캠프 최종 프로젝트 · OCI 기반 실제 배포',
    originLabel: '140.238.29.199',
  },
};
