/**
 * 수집 상태(백엔드 /api/dashboard sources[].status) → 배지 표시.
 * status: 'done' | 'running' | 'failed' | 'none'(한 번도 수집하지 않음)
 */
export const CRAWL_STATUS = {
  done: { label: '완료', tone: 'green' },
  running: { label: '수집 중', tone: 'blue' },
  failed: { label: '실패', tone: 'red' },
  none: { label: '기록 없음', tone: 'gray' },
};

export function getCrawlStatus(status) {
  return CRAWL_STATUS[status] ?? CRAWL_STATUS.running;
}

/** 사이트 여러 개 → 카드 제목 옆 전체 상태 (실패 > 수집 중 > 전부 기록 없음 > 완료) */
export function getOverallCrawlStatus(sources = []) {
  if (sources.some((source) => source.status === 'failed')) return { label: '일부 실패', tone: 'red' };
  if (sources.some((source) => source.status === 'running')) return CRAWL_STATUS.running;
  if (sources.length > 0 && sources.every((source) => source.status === 'none')) return CRAWL_STATUS.none;
  return CRAWL_STATUS.done;
}
