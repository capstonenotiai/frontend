import { MOCK_TODAY, USE_MOCK, URGENCY_DAYS } from '../config/app';

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** 'YYYY-MM-DD' → 로컬 Date (시간대 영향 없이). 빈 값/형식 오류면 null */
export function parseDate(value) {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Date → 'YYYY-MM-DD' */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 오늘 날짜 (mock 모드에서는 MOCK_TODAY 로 고정) */
export function getToday() {
  if (USE_MOCK) {
    const mockToday = parseDate(MOCK_TODAY);
    if (mockToday) return mockToday;
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** 날짜 차이(일). b - a */
export function diffDays(a, b) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / DAY_MS);
}

/** 오늘부터 dateString 까지 남은 일수. 날짜가 없으면 null */
export function daysUntil(dateString, today = getToday()) {
  const target = parseDate(dateString);
  return target ? diffDays(today, target) : null;
}

/** 남은 일수 → 'D-3' / 'D-DAY' / '마감' */
export function formatDday(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return '-';
  if (daysLeft === 0) return 'D-DAY';
  if (daysLeft < 0) return '마감';
  return `D-${daysLeft}`;
}

/**
 * 남은 일수 → 임박도
 *  hot  : D-3 이내 / warm : D-7 이내 / cool : D-14 이내 / far : 그 이후 / past : 마감 지남 / none : 날짜 없음
 */
export function getUrgency(daysLeft) {
  if (daysLeft === null || daysLeft === undefined) return 'none';
  if (daysLeft < 0) return 'past';
  if (daysLeft <= URGENCY_DAYS.hot) return 'hot';
  if (daysLeft <= URGENCY_DAYS.warm) return 'warm';
  if (daysLeft <= URGENCY_DAYS.cool) return 'cool';
  return 'far';
}

/** 임박도 → .pill 색상 */
export const URGENCY_PILL_TONE = {
  hot: 'red',
  warm: 'amber',
  cool: 'blue',
  far: 'gray',
  past: 'gray',
  none: 'gray',
};

/**
 * 기간 표시.
 *  full    : '2026-05-20 ~ 2026-05-30'
 *  compact : '2026-05-01 ~ 05-22'  (같은 해면 종료일 연도 생략)
 * start_date 가 '' 이면 '~ 2026-05-22' (모델이 시작일 없는 공지는 빈 문자열을 반환)
 */
export function formatRange(start, end, { compact = false } = {}) {
  if (!start && !end) return '';
  if (!start) return `~ ${end}`;
  if (!end) return `${start} ~`;
  const endLabel = compact && start.slice(0, 4) === end.slice(0, 4) ? end.slice(5) : end;
  return `${start} ~ ${endLabel}`;
}

/** '2026-05-22' → '5월 22일' */
export function formatMonthDay(dateString) {
  const date = parseDate(dateString);
  return date ? `${date.getMonth() + 1}월 ${date.getDate()}일` : '';
}

/** (2026, 4) → '2026년 5월'  (month 는 0부터) */
export function formatMonthLabel(year, month) {
  return `${year}년 ${month + 1}월`;
}

/** 'YYYY-MM' ↔ { year, month(0-based) } */
export function parseMonthKey(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key || '');
  if (!match) return null;
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year: Number(match[1]), month };
}

export function toMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export function shiftMonth({ year, month }, delta) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}
