/**
 * 대시보드 수집 현황 mock — 향후 GET /api/dashboard 응답을 가정.
 * (일정 개수 기반 통계는 events 에서 직접 계산하므로 여기에는 수집 관련 값만 둡니다)
 */
export const mockDashboardSummary = {
  collectedToday: 23,
  collectedChangeLabel: '+5 vs 어제',
  lastCollectedAt: '09:00',
  collectionFinishedAt: '09:04',
  referenceTimeLabel: '현재 오전 09:12 기준',
  greeting: '좋은 아침이에요',
  sources: [
    { source: 'cbnu', count: 11, progress: 78, status: 'done' },
    { source: 'wevity', count: 8, progress: 55, status: 'done' },
    { source: 'contestkorea', count: 4, progress: 30, status: 'done' },
  ],
};
