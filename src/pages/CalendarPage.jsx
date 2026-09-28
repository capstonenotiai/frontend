import { useState } from 'react';
import EventDetailPanel from '../components/EventDetailPanel';
import MonthCalendar from '../components/MonthCalendar';
import { SOURCES } from '../config/sources';
import { useAppData } from '../context/AppDataContext';
import { useCalendarMonth } from '../hooks/useCalendarMonth';
import { formatMonthLabel } from '../utils/date';

const VIEW_MODES = [
  { value: 'month', label: '월', ready: true },
  { value: 'week', label: '주', ready: false },
  { value: 'day', label: '일', ready: false },
];

export default function CalendarPage() {
  const { events } = useAppData();
  const { year, month, goPrev, goNext, goToday } = useCalendarMonth();
  // { type: 'event', id } | { type: 'day', date } | null
  const [selection, setSelection] = useState(null);

  // 선택된 일정이 등록 해제되면 상세 패널을 닫는다 (원본 동작)
  const selectedEvent =
    selection?.type === 'event' ? events.find((event) => event.id === selection.id && event.registered) : null;
  const selectedDate = selection?.type === 'day' ? selection.date : null;

  const changeMonth = (move) => {
    setSelection(null);
    move();
  };

  return (
    <>
      <div className="page-header">
        <div className="page-title">{formatMonthLabel(year, month)}</div>
        <div className="page-sub">등록된 일정을 캘린더로 확인하세요</div>
      </div>

      <div className="cal-toolbar">
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="cal-arr" aria-label="이전 달" onClick={() => changeMonth(goPrev)}>
            ‹
          </button>
          <button
            type="button"
            className="cal-arr"
            style={{ fontSize: 11, padding: '0 10px', width: 'auto' }}
            onClick={() => changeMonth(goToday)}
          >
            오늘
          </button>
          <button type="button" className="cal-arr" aria-label="다음 달" onClick={() => changeMonth(goNext)}>
            ›
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 1,
            background: 'var(--line)',
            border: '1px solid var(--line2)',
            borderRadius: 8,
            overflow: 'hidden',
            marginLeft: 'auto',
          }}
        >
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={`filter-btn ${mode.value === 'month' ? 'on' : ''}`.trim()}
              style={{ fontSize: 12 }}
              title={mode.ready ? undefined : '준비 중인 기능입니다'}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <MonthCalendar
        year={year}
        month={month}
        events={events}
        selectedEventId={selectedEvent?.id}
        onSelectEvent={(id) => setSelection({ type: 'event', id })}
        onSelectDay={(date) => setSelection({ type: 'day', date })}
      />

      <div className="cal-legend">
        {SOURCES.map((source) => (
          <div className="cl-item" key={source.id}>
            <span className={`cl-dot cal-legend-dot-src ${source.cssKey}`} />
            <span>{source.label}</span>
          </div>
        ))}
        <div className="cl-item">
          <span className="cl-dot cal-legend-dot-src urgent" />
          <span>D-7 이내 마감</span>
        </div>
      </div>

      <EventDetailPanel event={selectedEvent} date={selectedDate} onClose={() => setSelection(null)} />
    </>
  );
}
