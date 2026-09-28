import { useMemo, useState } from 'react';
import { buildMonthGrid, isSameDate } from '../utils/calendar';
import { WEEKDAYS_KO, formatMonthLabel, getToday, parseDate, shiftMonth } from '../utils/date';
import Card from './Card';
import { CalendarIcon } from './icons';

/**
 * 대시보드 미니 달력. 일정 마감일(end_date)에 점 표시 (임박도에 따라 색상).
 */
const DOT_CLASS = { hot: 'hot', warm: 'warm' };

export default function MiniCalendar({ events }) {
  const today = getToday();
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const cells = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  const deadlines = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const end = parseDate(event.end_date);
      if (!end || end.getFullYear() !== view.year || end.getMonth() !== view.month) return;
      const day = end.getDate();
      // 같은 날 여러 개면 더 급한 쪽 색상
      if (!map.has(day) || event.urgency === 'hot') map.set(day, event.urgency);
    });
    return map;
  }, [events, view]);

  return (
    <Card
      icon={<CalendarIcon />}
      title={formatMonthLabel(view.year, view.month)}
      headerRight={
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="cal-arr" aria-label="이전 달" onClick={() => setView((v) => shiftMonth(v, -1))}>
            ‹
          </button>
          <button type="button" className="cal-arr" aria-label="다음 달" onClick={() => setView((v) => shiftMonth(v, 1))}>
            ›
          </button>
        </div>
      }
    >
      <div className="cal-grid">
        {WEEKDAYS_KO.map((dow) => (
          <div key={dow} className="cal-dow">
            {dow}
          </div>
        ))}
        {cells.map((cell) => {
          if (!cell.inMonth) return <div key={cell.date.toISOString()} className="cal-day empty" />;
          const urgency = deadlines.get(cell.day);
          const classes = ['cal-day'];
          if (isSameDate(cell.date, today)) classes.push('today');
          if (urgency) classes.push('has-event', DOT_CLASS[urgency] ?? '');
          return (
            <div key={cell.date.toISOString()} className={classes.join(' ').trim()}>
              {cell.day}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
