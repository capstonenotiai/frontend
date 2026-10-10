import { layoutWeek } from './weekCalendar.js';

/** month는 기존 useCalendarMonth와 같은 0부터 시작하는 월이다. */
export function buildMonthGrid(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(year, month + 1, 0));
  first.setUTCDate(first.getUTCDate() - first.getUTCDay());
  last.setUTCDate(last.getUTCDate() + 6 - last.getUTCDay());
  const weeks = [];
  for (let cursor = first.getTime(); cursor <= last.getTime(); cursor += 7 * 86400000) {
    weeks.push(Array.from({ length: 7 }, (_, index) => new Date(cursor + index * 86400000).toISOString().slice(0, 10)));
  }
  return weeks;
}

export function filterByCategories(events, offCategories = []) {
  const off = new Set(offCategories);
  return events.filter((event) => !off.has(event.category));
}

/** 홈 배치를 보존하면서 월 달력에서만 하루 최대 3줄을 적용한다. */
export function layoutMonthWeek(events, dates) {
  // 면접은 기간이 있어도 마감일의 하루 일정으로 표시한다.
  const { bars, chips } = layoutWeek(events.map((event) => event.event_type === 'interview'
    ? { ...event, start_date: event.end_date || event.start_date } : event), dates);
  const visibleBars = bars.filter((bar) => bar.lane < 3);
  const days = dates.map((date, index) => {
    const covering = bars.filter((bar) => bar.colStart <= index + 1 && bar.colEnd >= index + 1);
    const visibleCovering = covering.filter((bar) => bar.lane < 3);
    const occupied = new Set(visibleCovering.map((bar) => bar.lane));
    const free = [0, 1, 2].filter((lane) => !occupied.has(lane));
    const visibleChips = chips[date].slice(0, free.length).map((id, i) => ({ id, lane: free[i] }));
    const ids = [...covering.map((bar) => bar.id), ...chips[date]];
    return { date, chips: visibleChips, ids, more: ids.length - visibleCovering.length - visibleChips.length };
  });
  return { bars: visibleBars, days };
}
