import { useMemo } from 'react';
import { getSource } from '../config/sources';
import { URGENCY_DAYS } from '../config/app';
import { buildEventSegments, buildMonthGrid, isSameDate } from '../utils/calendar';
import { WEEKDAYS_KO, getToday, parseDate } from '../utils/date';

/**
 * 캘린더 화면의 월 달력 (.full-cal). 원본 HTML 의 renderCalendar() 를 React 로 옮김.
 *  - 캘린더에 "등록된" 일정만 막대로 표시
 *  - 막대 클릭 → onSelectEvent, 일정이 없는 날짜 클릭 → onSelectDay
 */
export default function MonthCalendar({ year, month, events, selectedEventId, onSelectEvent, onSelectDay }) {
  const today = getToday();
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const registered = useMemo(() => events.filter((event) => event.registered), [events]);
  const { segments, coveredDays } = useMemo(
    () => buildEventSegments(registered, year, month),
    [registered, year, month],
  );

  // D-7 이내 마감일 칸 강조 (범례의 'D-7 이내 마감')
  const urgentDays = useMemo(() => {
    const days = new Set();
    registered.forEach((event) => {
      const end = parseDate(event.end_date);
      if (!end || end.getFullYear() !== year || end.getMonth() !== month) return;
      if (event.daysLeft !== null && event.daysLeft >= 0 && event.daysLeft <= URGENCY_DAYS.warm) days.add(end.getDate());
    });
    return days;
  }, [registered, year, month]);

  return (
    <div className="full-cal">
      <div className="fcal-head">
        {WEEKDAYS_KO.map((dow) => (
          <div key={dow} className="fcal-dow">
            {dow}
          </div>
        ))}
      </div>
      <div className="fcal-grid">
        {cells.map((cell) => {
          const position = { gridRow: cell.row, gridColumn: cell.col };
          if (!cell.inMonth) {
            return <div key={cell.date.toISOString()} className="fcal-cell off" style={position} />;
          }
          const isToday = isSameDate(cell.date, today);
          const classes = ['fcal-cell'];
          if (isToday) classes.push('today-cell');
          if (urgentDays.has(cell.day)) classes.push('urgent-cell');
          return (
            <div
              key={cell.date.toISOString()}
              className={classes.join(' ')}
              style={position}
              onClick={() => {
                // 막대가 걸쳐 있는 날은 막대 클릭으로 처리 (원본 동작과 동일)
                if (!coveredDays.has(cell.day)) onSelectDay(cell.date);
              }}
            >
              <div className={`fcal-num ${isToday ? 'today-num' : ''}`.trim()}>{cell.day}</div>
            </div>
          );
        })}

        {segments.map((segment) => {
          const classes = ['fcal-bar', `${getSource(segment.source).cssKey}-ev`];
          if (segment.includesEnd) classes.push('ev-due');
          if (segment.eventId === selectedEventId) classes.push('ev-sel');
          return (
            <button
              type="button"
              key={segment.key}
              className={classes.join(' ')}
              style={{
                gridRow: segment.row,
                gridColumn: `${segment.colStart} / ${segment.colEnd + 1}`,
                marginTop: 26 + segment.stack * 20,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectEvent(segment.eventId);
              }}
            >
              {segment.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}
