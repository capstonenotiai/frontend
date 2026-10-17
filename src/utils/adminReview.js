const dateToken = /(?<!\d)(?:(\d{4})\s*[.년/\-]\s*)?(\d{1,2})\s*[.월/\-]\s*(\d{1,2})(?!\d)(?:\s*일)?/g;
export function dateLines(body, events) {
  const dates = events.flatMap(e => [e.start_date, e.end_date]).filter(Boolean);
  return (body || '').split(/\r?\n/).flatMap((line, index) => {
    const tokens = [...line.matchAll(dateToken)].filter(m => {
      const month = Number(m[2]), day = Number(m[3]);
      return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Number(m[1]) || 2000, month, 0).getDate();
    });
    if (!tokens.length) return [];
    const parts = []; let cursor = 0;
    for (const m of tokens) {
      parts.push({ text: line.slice(cursor, m.index), match: false });
      parts.push({ text: m[0], match: dates.some(d => { const [y, month, day] = d.split('-').map(Number); return (!m[1] || Number(m[1]) === y) && Number(m[2]) === month && Number(m[3]) === day; }) });
      cursor = m.index + m[0].length;
    }
    parts.push({ text: line.slice(cursor), match: false });
    return [{ index, parts }];
  });
}
