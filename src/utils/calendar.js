import { diffDays, parseDate } from './date';
import { shortTitle } from './events';

/**
 * 월 달력 grid 생성 (일요일 시작).
 * 반환: 주 단위 배열. 각 칸은 { date, day, inMonth, row(1부터), col(1~7) }
 */
export function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

  const cells = [];
  for (let index = 0; index < totalCells; index += 1) {
    const date = new Date(year, month, index - leading + 1);
    cells.push({
      date,
      day: date.getDate(),
      inMonth: date.getMonth() === month,
      row: Math.floor(index / 7) + 1,
      col: (index % 7) + 1,
    });
  }
  return cells;
}

/**
 * 등록된 일정을 달력 막대(segment)로 변환. 원본 HTML 의 renderCalendar() 로직을 옮김.
 *  - 한 주(row)를 넘는 일정은 주마다 잘라서 여러 막대로 표시
 *  - 같은 주에 막대가 여러 개면 stack 으로 세로 위치를 나눔
 *  - start_date 가 '' 이면 마감일 하루짜리 막대
 */
export function buildEventSegments(events, year, month) {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const leading = monthStart.getDay();
  const rowStack = {};
  const segments = [];
  const coveredDays = new Set();

  events.forEach((event) => {
    const end = parseDate(event.end_date);
    if (!end) return;
    const start = parseDate(event.start_date) ?? end;
    if (end < monthStart || start > monthEnd) return;

    const lo = start < monthStart ? 1 : start.getDate();
    const hi = end > monthEnd ? monthEnd.getDate() : end.getDate();
    const endsInMonth = end <= monthEnd;
    const startsInMonth = start >= monthStart;
    const label = shortTitle(event.title, 14);

    let segStart = lo;
    while (segStart <= hi) {
      const index = leading + segStart - 1;
      const row = Math.floor(index / 7) + 1;
      const colStart = (index % 7) + 1;
      const segEnd = Math.min(hi, segStart + (7 - colStart));

      for (let day = segStart; day <= segEnd; day += 1) coveredDays.add(day);

      const stack = rowStack[row] ?? 0;
      rowStack[row] = stack + 1;

      const includesEnd = endsInMonth && segEnd === hi;
      let text = label;
      if (includesEnd) text = `${label} 마감`;
      else if (startsInMonth && segStart === lo) text = `${label} 시작`;

      segments.push({
        key: `${event.id}-${row}`,
        eventId: event.id,
        source: event.source,
        row,
        colStart,
        colEnd: colStart + (segEnd - segStart),
        stack,
        text,
        includesEnd,
        endDay: segEnd,
      });
      segStart = segEnd + 1;
    }
  });

  return { segments, coveredDays };
}

/** 날짜가 같은지 */
export function isSameDate(a, b) {
  return !!a && !!b && diffDays(a, b) === 0;
}
