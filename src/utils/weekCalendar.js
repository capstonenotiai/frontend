// 로컬 날짜를 UTC 날짜로 옮겨 DST와 실행 환경의 시간대 영향을 피한다.
export function buildWeek(today, offset = 0) {
  const iso = typeof today === 'string' ? today : `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const base = new Date(`${iso}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(date.getUTCDate() + offset * 7 + index);
    return date.toISOString().slice(0, 10);
  });
}

const deadline = (event) => event.end_date || event.start_date;
const visible = (event) => event.registered && !event.dismissed;

export function layoutWeek(events, weekDates) {
  const chips = Object.fromEntries(weekDates.map((date) => [date, []]));
  const bars = [];
  if (!weekDates.length) return { bars, chips };
  const first = weekDates[0], last = weekDates.at(-1);
  const periods = [];
  for (const event of events.filter(visible)) {
    const end = deadline(event);
    if (!end) continue;
    if (event.start_date && event.start_date < end) {
      // 주 밖에서 끝나더라도 현재 주와 겹치는 기간은 이어지는 막대로 보인다.
      if (end >= first && event.start_date <= last) periods.push(event);
    } else if (chips[end]) chips[end].push(event.id);
  }
  periods.sort((a, b) => a.start_date.localeCompare(b.start_date) || deadline(a).localeCompare(deadline(b)) || String(a.id).localeCompare(String(b.id)));
  const laneEnds = [];
  for (const event of periods) {
    const colStart = weekDates.indexOf(event.start_date < first ? first : event.start_date) + 1;
    const colEnd = weekDates.indexOf(deadline(event) > last ? last : deadline(event)) + 1;
    let lane = laneEnds.findIndex((end) => end < colStart);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = colEnd;
    bars.push({ id: event.id, colStart, colEnd, lane, openLeft: event.start_date < first, openRight: deadline(event) > last });
  }
  return { bars, chips };
}

export function weekProgress(events, weekDates) {
  const due = events.filter((event) => visible(event) && weekDates.includes(deadline(event)));
  return { done: due.filter((event) => event.action_status === 'done').length, total: due.length };
}
