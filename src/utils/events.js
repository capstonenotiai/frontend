import { getSource } from '../config/sources';
import { daysUntil, formatDday, getToday, getUrgency } from './date';

/** 화면 표시용 파생 값(D-day, 임박도, 출처 정보)을 붙인다. 원본 데이터는 바꾸지 않음 */
export function enrichEvent(event, today = getToday()) {
  const daysLeft = daysUntil(event.end_date, today);
  return {
    ...event,
    daysLeft,
    dday: formatDday(daysLeft),
    urgency: getUrgency(daysLeft),
    sourceInfo: getSource(event.source),
  };
}

/** 마감일 오름차순 (마감일 없는 일정은 뒤로) */
export function compareByDeadline(a, b) {
  const aKey = a.end_date || '9999-12-31';
  const bKey = b.end_date || '9999-12-31';
  return aKey.localeCompare(bKey);
}

/** 'D-7 이내' 마감 (오늘 포함, 지난 일정 제외) */
export function isDueWithin(event, days) {
  return event.daysLeft !== null && event.daysLeft >= 0 && event.daysLeft <= days;
}

/** 캘린더 막대 / 알림용 짧은 제목 — 앞의 연도·회차 표기 제거 (원본 HTML 과 동일 규칙) */
export function shortTitle(title, maxLength) {
  const trimmed = (title || '').replace(/^\d{4}\s|^제\d+회\s/, '');
  return maxLength ? trimmed.slice(0, maxLength) : trimmed;
}
