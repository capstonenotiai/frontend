import { getSource } from '../config/sources';

/**
 * 출처 뱃지. variant 별로 원본 디자인의 클래스를 그대로 사용
 *  - 'schedule'  : .sc-src         (일정 목록)
 *  - 'dashboard' : .new-src-badge  (대시보드 신규 일정)
 */
const VARIANT_CLASS = {
  schedule: 'sc-src',
  dashboard: 'new-src-badge',
};

export default function SourceBadge({ source, variant = 'schedule' }) {
  const info = getSource(source);
  return <span className={`${VARIANT_CLASS[variant]} ${info.cssKey}`}>{info.label}</span>;
}
