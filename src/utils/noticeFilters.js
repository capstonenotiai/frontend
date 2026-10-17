const compareNotices = (a, b) => {
  // 화면의 '마감' 표시와 같은 daysLeft를 사용한다. 날짜 미확인은 미마감 쪽에 둔다.
  const aEnded = a.daysLeft < 0, bEnded = b.daysLeft < 0;
  if (aEnded !== bEnded) return aEnded ? 1 : -1;
  const deadline = (a.end_date || a.start_date || '9999-12-31')
    .localeCompare(b.end_date || b.start_date || '9999-12-31');
  return (aEnded ? -deadline : deadline) || (a.title || '').localeCompare(b.title || '', 'ko');
};

export function filterNotices(events, { category = 'all', source = 'all', query = '' } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return events.filter((event) => (category === 'all' || event.category === category)
    && (source === 'all' || event.source === source)
    && (event.title || '').toLocaleLowerCase().includes(term)).sort(compareNotices);
}

export function savedList(events) {
  return events.filter((event) => event.bookmarked && !event.registered && !event.dismissed).sort(compareNotices);
}

export function hiddenList(events) {
  return events.filter((event) => event.dismissed).sort(compareNotices);
}

// 현재 API의 HH:mm과 날짜를 포함한 ISO 응답을 모두 지원한다.
// 시각만 있는 응답은 수집 날짜를 알 수 없으므로 '오늘'이라고 추측하지 않는다.
export function collectionTimeLabel(value, now = new Date()) {
  if (!value || value === '-') return '';
  const time = /^(\d{2}):(\d{2})$/.exec(value);
  if (time) {
    const hour = Number(time[1]);
    return hour < 24 && Number(time[2]) < 60 ? `${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${time[2]}` : '';
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = (dateValue) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(dateValue).map(({ type, value: part }) => [type, part]));
  const collected = parts(date);
  const today = parts(now);
  const sameDay = ['year', 'month', 'day'].every((key) => collected[key] === today[key]);
  const hour = Number(collected.hour);
  return `${sameDay ? '오늘' : `${Number(collected.month)}월 ${Number(collected.day)}일`} ${hour < 12 ? '오전' : '오후'} ${hour % 12 || 12}:${collected.minute}`;
}
