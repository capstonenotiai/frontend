import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import LoadError from '../components/LoadError';
import EventPopover, { AnchoredDialog } from '../components/events/EventPopover';
import { categoryClass } from '../components/events/EventRow';
import { CheckIcon, ChevronIcon } from '../components/icons';
import { INTEREST_CATEGORIES } from '../config/interestCategories';
import { useAppData } from '../context/AppDataContext';
import { useCalendarMonth } from '../hooks/useCalendarMonth';
import { getToday, toISODate, WEEKDAYS_KO, formatMonthLabel } from '../utils/date';
import { buildMonthGrid, filterByCategories, layoutMonthWeek } from '../utils/monthCalendar';

function CalendarEvent({ event, onClick, className = '', style }) {
  const done = event.action_status === 'done';
  return <button type="button" className={`calendar-event ${categoryClass(event.category)} ${done ? 'is-done' : ''} ${className}`}
    style={style} title={event.title} aria-label={`${done ? '완료한 일정: ' : ''}${event.title}`} onClick={onClick}>
    {done ? <CheckIcon /> : <i aria-hidden="true" />}<span>{event.title}</span>
  </button>;
}

export default function CalendarPage() {
  const { calendarEvents, status, error, actionError, refresh } = useAppData();
  const { year, month, goPrev, goNext, goToday } = useCalendarMonth();
  const [params, setParams] = useSearchParams();
  const offKey = params.get('off') || '';
  const off = useMemo(() => new Set(offKey.split(',').filter((id) => INTEREST_CATEGORIES.some((cat) => cat.id === id))), [offKey]);
  const weeks = useMemo(() => buildMonthGrid(year, month), [year, month]);
  const events = useMemo(() => filterByCategories(calendarEvents.filter((event) => event.registered && !event.dismissed), off), [calendarEvents, off]);
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const layouts = useMemo(() => weeks.map((dates) => layoutMonthWeek(events, dates)), [weeks, events]);
  const [selection, setSelection] = useState(null);
  const fallbackRef = useRef(null);
  const close = useCallback(() => setSelection(null), []);
  const today = getToday(), todayISO = toISODate(today);
  const allOff = off.size === INTEREST_CATEGORIES.length;
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const hasMonthEvents = layouts.some(({ days }) => days.some((day) => day.date.startsWith(monthKey) && day.ids.length));
  const selectedEvent = selection?.type === 'event' ? byId.get(selection.id) : null;
  useEffect(() => { close(); }, [year, month, offKey, close]);
  useEffect(() => { if (selection?.type === 'event' && !selectedEvent) close(); }, [selection, selectedEvent, close]);
  const changeCategories = (nextOff) => {
    close();
    setParams((current) => {
      const next = new URLSearchParams(current);
      const value = INTEREST_CATEGORIES.filter(({ id }) => nextOff.has(id)).map(({ id }) => id).join(',');
      if (value) next.set('off', value); else next.delete('off');
      return next;
    });
  };
  const openEvent = (id, anchor) => setSelection({ type: 'event', id, anchor });
  const dayItems = selection?.type === 'day'
    ? layouts.flatMap(({ days }) => days).find((day) => day.date === selection.date)?.ids.map((id) => byId.get(id)).filter(Boolean) || [] : [];

  return <section className="card calendar-card" aria-label="등록한 일정 월간 달력">
    <div className="calendar-header">
      <div className="calendar-navigation">
        <button ref={fallbackRef} type="button" className="event-button calendar-arrow" aria-label="이전 달" onClick={() => { close(); goPrev(); }}><ChevronIcon direction="left" /></button>
        <h2>{formatMonthLabel(year, month)}</h2>
        <button type="button" className="event-button calendar-arrow" aria-label="다음 달" onClick={() => { close(); goNext(); }}><ChevronIcon /></button>
        <button type="button" className="event-button" disabled={year === today.getFullYear() && month === today.getMonth()} onClick={() => { close(); goToday(); }}>오늘</button>
      </div>
      <div className="calendar-categories" role="group" aria-label="분야 필터">
        {INTEREST_CATEGORIES.map(({ id, label }) => <button key={id} type="button" className={`calendar-category ${categoryClass(id)}`} aria-pressed={!off.has(id)}
          onClick={() => { const next = new Set(off); if (next.has(id)) next.delete(id); else next.add(id); changeCategories(next); }}><i aria-hidden="true" />{label}</button>)}
      </div>
    </div>
    {status === 'ready' && !hasMonthEvents && <p className="calendar-empty">{allOff ? <>모든 분야를 껐어요. <button type="button" className="event-link" onClick={() => changeCategories(new Set())}>모두 켜기</button></>
      : <>이번 달에 등록한 일정이 없어요. <Link className="event-link" to="/schedules">전체 공지 보기</Link></>}</p>}
    {status === 'error' && <LoadError message={error?.message} onRetry={() => refresh()} />}
    {actionError && !selectedEvent && <p className="event-error" role="alert">{actionError.message}</p>}
    <div className="calendar-month" aria-busy={status === 'loading'}>
      <div className="calendar-weekdays">{WEEKDAYS_KO.map((day) => <span key={day}>{day}</span>)}</div>
      {weeks.map((dates, weekIndex) => <div className="calendar-week" key={dates[0]}>
        {layouts[weekIndex].days.map((day, col) => {
          const date = new Date(`${day.date}T00:00:00Z`);
          const isToday = day.date === todayISO;
          return <div key={day.date} className="calendar-day" role="group" style={{ gridColumn: col + 1 }}
            aria-label={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 ${WEEKDAYS_KO[col]}요일${isToday ? ', 오늘' : ''}`}>
            <span className={`calendar-date ${date.getUTCMonth() !== month ? 'outside-month' : ''} ${isToday ? 'is-today' : ''}`}>{date.getUTCDate()}</span>
            {status === 'loading' ? (col % 2 === 0 && <span className="calendar-skeleton" aria-hidden="true" />) : <>
              {day.chips.map(({ id, lane }) => <CalendarEvent key={id} event={byId.get(id)} style={{ gridRow: lane + 2 }} onClick={(e) => openEvent(id, e.currentTarget)} />)}
              {day.more > 0 && <button type="button" className="calendar-more" aria-label={`${date.getUTCMonth() + 1}월 ${date.getUTCDate()}일 일정 ${day.more}개 더 보기`}
                onClick={(e) => setSelection({ type: 'day', date: day.date, anchor: e.currentTarget })}>+{day.more}개 더</button>}
            </>}
          </div>;
        })}
        {status !== 'loading' && layouts[weekIndex].bars.map((bar) => <CalendarEvent key={bar.id} event={byId.get(bar.id)}
          className={`calendar-bar ${bar.openLeft ? 'open-left' : ''} ${bar.openRight ? 'open-right' : ''}`}
          style={{ gridColumn: `${bar.colStart} / ${bar.colEnd + 1}`, gridRow: bar.lane + 2 }} onClick={(e) => openEvent(bar.id, e.currentTarget)} />)}
      </div>)}
    </div>
    {selectedEvent && <EventPopover event={selectedEvent} anchor={selection.anchor} fallbackRef={fallbackRef} onClose={close} />}
    {selection?.type === 'day' && <AnchoredDialog anchor={selection.anchor} fallbackRef={fallbackRef} title={`${Number(selection.date.slice(5, 7))}월 ${Number(selection.date.slice(8))}일 일정`} onClose={close}>
      <div className="calendar-day-list">{dayItems.map((event) => <CalendarEvent key={event.id} event={event} onClick={() => openEvent(event.id, selection.anchor)} />)}</div>
    </AnchoredDialog>}
  </section>;
}
