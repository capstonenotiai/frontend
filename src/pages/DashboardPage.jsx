import { useState } from 'react';
import { Link } from 'react-router-dom';
import EventRow, { categoryClass } from '../components/events/EventRow';
import { ChevronIcon } from '../components/icons';
import { INTEREST_CATEGORIES } from '../config/interestCategories';
import { useAppData } from '../context/AppDataContext';
import { getToday, toISODate, parseDate, formatMonthDay, WEEKDAYS_KO } from '../utils/date';
import { compareByDeadline } from '../utils/events';
import { buildWeek, layoutWeek, weekProgress } from '../utils/weekCalendar';

export default function DashboardPage() {
  const { events, calendarEvents, status, error, actionError, refresh, actionBusy } = useAppData();
  const [offset, setOffset] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [newOpenId, setNewOpenId] = useState(null);
  const [expandedDays, setExpandedDays] = useState({});
  const today = toISODate(getToday());
  const weekDates = buildWeek(today, offset);
  const registered = calendarEvents.filter((event) => event.registered && !event.dismissed);
  const layout = layoutWeek(registered, weekDates);
  const progress = weekProgress(registered, weekDates);
  const laneCount = Math.max(0, ...layout.bars.map((bar) => bar.lane + 1));
  const visibleIds = new Set([...layout.bars.map((bar) => bar.id), ...Object.values(layout.chips).flat()]);
  const selected = registered.find((event) => event.id === selectedId && visibleIds.has(event.id));
  const byId = new Map(registered.map((event) => [event.id, event]));
  const newEvents = events.filter((event) => event.is_new && !event.dismissed && !(event.daysLeft < 0)).sort(compareByDeadline);
  const loading = status === 'loading' && !events.length && !calendarEvents.length;
  const pick = (id) => setSelectedId((previous) => previous === id ? null : id);
  const shift = (next) => { setOffset(next); setSelectedId(null); setExpandedDays({}); };
  const calendarButton = (event, bar) => <button key={event.id} type="button"
    className={`week-event ${bar ? 'week-bar' : 'week-chip'} ${categoryClass(event.category)} ${event.action_status === 'done' ? 'is-done' : ''} ${bar?.openLeft ? 'open-left' : ''} ${bar?.openRight ? 'open-right' : ''}`}
    style={bar ? { gridColumn: `${bar.colStart} / ${bar.colEnd + 1}`, gridRow: bar.lane + 1 } : undefined}
    title={event.title} aria-expanded={selected?.id === event.id} aria-controls="home-week-detail" onClick={() => pick(event.id)}>
    <span className="week-event-title">{event.title}</span>
  </button>;
  return <div className="home-dashboard">
    <section className="home-card" aria-labelledby="home-week-title">
      <header className="week-header"><h2 id="home-week-title">{['이번 주', '다음 주', '2주 뒤'][offset]}</h2>
        <span className="week-range">{formatMonthDay(weekDates[0])} ~ {formatMonthDay(weekDates[6])} · 완료 {progress.done}/{progress.total}</span>
        <div className="week-navigation"><button type="button" aria-label="이전 7일" disabled={offset === 0} onClick={() => shift(offset - 1)}><ChevronIcon direction="left" /></button>
          <button type="button" aria-label="다음 7일" disabled={offset === 2} onClick={() => shift(offset + 1)}><ChevronIcon /></button></div>
        <div className="week-legend" aria-label="분야 색 안내">{INTEREST_CATEGORIES.map((category) => <span key={category.id} className={categoryClass(category.id)}><i aria-hidden="true" />{category.label}</span>)}</div>
      </header>
      {error && <p className="event-error" role="alert">{error.message} <button type="button" className="event-link" disabled={actionBusy} onClick={refresh}>다시 불러오기</button></p>}
      <div className="week-scroll"><div className="week-calendar" aria-busy={loading}>
        <div className="week-weekdays">{weekDates.map((iso) => <span key={iso} className={parseDate(iso).getDay() === 0 ? 'is-sunday' : ''}>{WEEKDAYS_KO[parseDate(iso).getDay()]}</span>)}</div>
        <div className="week-body" style={{ '--week-lanes': laneCount }}>
          <div className="week-days">{weekDates.map((iso) => {
            const date = parseDate(iso), isToday = iso === today;
            const ids = layout.chips[iso], more = expandedDays[iso];
            return <div key={iso} className={`week-day ${isToday ? 'is-today' : ''}`} role="group" aria-label={`${formatMonthDay(iso)} ${WEEKDAYS_KO[date.getDay()]}요일${isToday ? ', 오늘' : ''}`}>
              <div className="week-day-heading"><span className="week-date">{date.getDate()}</span>{(isToday || iso === buildWeek(today, 0)[1]) && <span className="week-relative">{isToday ? '오늘' : '내일'}</span>}</div>
              <div className="week-chips" id={`home-day-${iso}`}>
                {loading ? <><span className="week-placeholder" /><span className="week-placeholder" /></> : (more ? ids : ids.slice(0, 3)).map((id) => calendarButton(byId.get(id)))}
                {ids.length > 3 && <button type="button" className="week-more" aria-expanded={Boolean(more)} aria-controls={`home-day-${iso}`} onClick={() => setExpandedDays({ ...expandedDays, [iso]: !more })}>{more ? '접기' : `+${ids.length - 3}건`}</button>}
              </div>
            </div>;
          })}</div>
          <div className="week-bars">{layout.bars.map((bar) => calendarButton(byId.get(bar.id), bar))}</div>
        </div>
      </div></div>
      <div id="home-week-detail" className="week-detail">
        {selected ? <EventRow event={selected} mode="mine" open onToggle={() => pick(selected.id)} idPrefix="home-mine" /> : <p className="week-hint">
          {loading ? '일정을 불러오는 중…' : !registered.length ? '아직 캘린더에 등록한 일정이 없어요. 전체 공지에서 일정을 등록해 보세요.' : progress.total === 0 ? '이번 주에 마감되는 등록 일정이 없어요.' : '일정을 누르면 여기에 자세히 보여요.'}
          {!loading && (!registered.length || progress.total === 0) && <> <Link to="/schedules">전체 공지 보기</Link></>}
        </p>}
        {!selected && actionError && <p className="event-error" role="alert">{actionError.message}</p>}
      </div>
    </section>
    <section className="home-card" aria-labelledby="home-new-title"><h2 id="home-new-title">새로 올라온 공지 <span className="home-new-count">{newEvents.length}</span>건</h2>
      <div className="home-new-list">{newEvents.slice(0, 4).map((event) => <EventRow key={event.id} event={event} mode="new" open={newOpenId === event.id} onToggle={() => setNewOpenId(newOpenId === event.id ? null : event.id)} idPrefix="home-new" />)}</div>
      {!newEvents.length && <p className="week-hint">{loading ? '공지를 불러오는 중…' : '새로 올라온 공지가 없어요.'}</p>}
      <Link className="home-view-all" to="/schedules">{newEvents.length > 4 ? `나머지 ${newEvents.length - 4}건 더 보기` : '전체 공지 보기'}</Link>
    </section>
  </div>;
}
