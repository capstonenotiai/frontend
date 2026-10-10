const DAYS = ['일', '월', '화', '수', '목', '금', '토'];

function dateLabel(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return '';
  return `${date.getUTCMonth() + 1}.${date.getUTCDate()}(${DAYS[date.getUTCDay()]})`;
}

/** 일정의 날짜와 시각을 시간대에 영향받지 않는 한국어로 표시한다. */
export function formatScheduleWhen({ start_date, end_date, start_time, end_time } = {}) {
  const start = dateLabel(start_date), end = dateLabel(end_date);
  const from = [start, start_time].filter(Boolean).join(' ');
  const to = [end, end_time].filter(Boolean).join(' ');
  if (start && end && start_date !== end_date) return `${from} ~ ${to}`;
  const date = start || end;
  if (!date) return '날짜 미확인';
  const times = [...new Set([start_time, end_time].filter(Boolean))];
  return `${date}${times.length ? ` ${times.join(' ~ ')}` : ''}`;
}
