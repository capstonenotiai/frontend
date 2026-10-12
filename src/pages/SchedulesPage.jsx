import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import EventRow, { categoryClass } from '../components/events/EventRow';
import NoticeListState from '../components/events/NoticeListState';
import { SearchIcon, CloseIcon } from '../components/icons';
import { INTEREST_CATEGORIES } from '../config/interestCategories';
import { SOURCES } from '../config/sources';
import { useAppData } from '../context/AppDataContext';
import { collectionTimeLabel, filterNotices } from '../utils/noticeFilters';
import { getToday } from '../utils/date';

export default function SchedulesPage() {
  const { events, summary, status } = useAppData();
  const [params, setParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const rows = useRef(new Map());
  const category = INTEREST_CATEGORIES.some(({ id }) => id === params.get('cat')) ? params.get('cat') : 'all';
  const source = SOURCES.some(({ id }) => id === params.get('src')) ? params.get('src') : 'all';
  const query = params.get('q') || '';
  const visible = useMemo(() => filterNotices(events, { category, source, query }), [events, category, source, query]);
  const collectedAt = collectionTimeLabel(summary?.lastCollectedAt, getToday());
  const updateFilter = (key, value) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    return next;
  }, { replace: true });
  const resetFilters = () => setParams((current) => {
    const next = new URLSearchParams(current);
    ['cat', 'src', 'q'].forEach((key) => next.delete(key));
    return next;
  }, { replace: true });

  // 알림 진입: 필터를 풀고 렌더링한 다음 해당 줄에 포커스를 옮긴다.
  useEffect(() => {
    const id = params.get('open');
    if (!id || status !== 'ready') return;
    const target = events.find((event) => String(event.id) === id);
    const next = new URLSearchParams(params);
    next.delete('open');
    if (target) {
      if (!visible.some((event) => event.id === target.id)) ['cat', 'src', 'q'].forEach((key) => next.delete(key));
      setSelectedId(target.id);
      setFocusId(target.id);
    }
    setParams(next, { replace: true });
  }, [events, status, params, setParams, visible]);

  useEffect(() => {
    if (!focusId) return;
    const row = rows.current.get(focusId);
    if (!row) return;
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    setFocusId(null);
  }, [focusId, visible]);

  useEffect(() => {
    if (status === 'ready' && selectedId && !visible.some((event) => event.id === selectedId)) setSelectedId(null);
  }, [visible, status, selectedId]);

  return <section className="card notices-card">
    <div className="card-header"><h2 className="card-title">공지 <strong>{visible.length}</strong>건</h2>
      {collectedAt && <span className="notices-description">마지막 수집 {collectedAt}</span>}
    </div>
    <div className="notice-tools">
      <div className="notice-categories" role="group" aria-label="분야">
        <button type="button" className="notice-chip" aria-pressed={category === 'all'} onClick={() => updateFilter('cat', 'all')}>전체</button>
        {INTEREST_CATEGORIES.map(({ id, label }) => <button key={id} type="button" className={`notice-chip ${categoryClass(id)}`}
          aria-pressed={category === id} onClick={() => updateFilter('cat', id)}><i aria-hidden="true" />{label}</button>)}
      </div>
      <select className="notice-source" aria-label="출처" value={source} onChange={(e) => updateFilter('src', e.target.value)}>
        <option value="all">출처 전체</option>{SOURCES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
      </select>
      <div className="notice-search"><SearchIcon /><input aria-label="공지 검색" placeholder="공지 검색" value={query} onChange={(e) => updateFilter('q', e.target.value)} />
        {query && <button type="button" aria-label="검색어 지우기" onClick={() => updateFilter('q', '')}><CloseIcon /></button>}
      </div>
    </div>
    <NoticeListState>
      <div className="notice-list">{visible.map((event) => <EventRow key={event.id} event={event} mode="new" idPrefix="notices"
        open={selectedId === event.id} onToggle={() => setSelectedId(selectedId === event.id ? null : event.id)}
        rowRef={(row) => { if (row) rows.current.set(event.id, row); else rows.current.delete(event.id); }} />)}</div>
      {!events.length ? <EmptyState>아직 모은 공지가 없어요.</EmptyState> : !visible.length && <EmptyState>
        조건에 맞는 공지가 없어요. <button type="button" className="event-link" onClick={resetFilters}>필터 초기화</button>
      </EmptyState>}
    </NoticeListState>
  </section>;
}
