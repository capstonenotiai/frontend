/**
 * 수집 사이트(출처) 목록.
 *
 * id 는 model repo 크롤러의 `site` 값과 동일하게 맞춤
 *   crawler/cbnu.py → "cbnu", crawler/wevity.py → "wevity", crawler/contestkorea.py → "contestkorea"
 *
 * - cssKey    : 기존 디자인의 CSS 클래스 접미사 (.sc-src.cbnu / .sc-src.wevity / .sc-src.contest 등)
 * - type      : 사이트 성격 (Landing / Settings 표시용)
 * - color     : 수집 현황 막대 색상
 */
export const SOURCES = [
  { id: 'cbnu', label: 'CBNU 포털', shortLabel: 'CBNU', cssKey: 'cbnu', type: '학교 공지', color: 'var(--blue)' },
  { id: 'wevity', label: 'Wevity', shortLabel: 'Wevity', cssKey: 'wevity', type: '공모전', color: '#7C3AED' },
  { id: 'contestkorea', label: 'ContestKorea', shortLabel: 'ContestKorea', cssKey: 'contest', type: '공모전', color: 'var(--teal)' },
];

const FALLBACK_SOURCE = { id: 'unknown', label: '기타', shortLabel: '기타', cssKey: 'cbnu', type: '기타', color: 'var(--t3)' };

export function getSource(id) {
  return SOURCES.find((source) => source.id === id) ?? { ...FALLBACK_SOURCE, id, label: id || FALLBACK_SOURCE.label };
}

/** 정렬(사이트순)에 쓰는 순서 */
export function getSourceOrder(id) {
  const index = SOURCES.findIndex((source) => source.id === id);
  return index === -1 ? SOURCES.length : index;
}
