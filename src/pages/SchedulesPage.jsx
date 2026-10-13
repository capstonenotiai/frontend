import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import EventRow, { categoryClass } from '../components/events/EventRow';
import NoticeListState from '../components/events/NoticeListState';
import { SearchIcon, CloseIcon } from '../components/icons';
import { INTEREST_CATEGORIES } from '../config/interestCategories';
import { SOURCES } from '../config/sources';
import { useAppData } from '../context/AppDataContext';
import { collectionTimeLabel, filterNotices } from '../utils/noticeFilters';
import { getToday } from '../utils/date';

// BrowserRouter의 반영이 늦어도 실제 탐색이 일어났는지 확인한다.
const browserLocation = () => typeof window === 'undefined' ? null : `${window.location.href}\n${window.history.state?.key || ''}`;

export default function SchedulesPage() {
  const { events, summary, status } = useAppData();
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigationType = useNavigationType();
  const [query, setQuery] = useState(() => params.get('q') || '');
  const search = useRef({ params, query, timer: null, revision: 0, composing: false, cancelledComposition: false,
    locationKey: location.key, browserLocation: browserLocation(), ownKeys: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const rows = useRef(new Map());
  const category = INTEREST_CATEGORIES.some(({ id }) => id === params.get('cat')) ? params.get('cat') : 'all';
  const source = SOURCES.some(({ id }) => id === params.get('src')) ? params.get('src') : 'all';
  const visible = useMemo(() => filterNotices(events, { category, source, query }), [events, category, source, query]);
  const collectedAt = collectionTimeLabel(summary?.lastCollectedAt, getToday());
  const cancelSearchTimer = useCallback(() => {
    clearTimeout(search.current.timer);
    search.current.timer = null;
    search.current.revision += 1;
  }, []);
  const invalidateSearch = useCallback(() => {
    cancelSearchTimer();
    const current = search.current;
    current.cancelledComposition ||= current.composing;
    current.composing = false;
  }, [cancelSearchTimer]);
  const replaceParams = useCallback((next) => {
    const current = search.current;
    if (current.browserLocation !== browserLocation()) return;
    if (next.toString() === current.params.toString()) return;
    // 연속 갱신은 렌더 시점의 setParams 콜백 대신 마지막으로 쓴 파라미터에 합친다.
    current.params = next;
    setParams(next, { replace: true });
    current.browserLocation = browserLocation();
    current.ownKeys.push(window.history.state?.key);
  }, [setParams]);

  useLayoutEffect(() => {
    const current = search.current;
    if (current.locationKey === location.key) return;
    current.locationKey = location.key;
    const ownIndex = navigationType === 'REPLACE' ? current.ownKeys.indexOf(location.key) : -1;
    if (ownIndex !== -1) {
      // 이전 입력의 URL 반영은 최신 로컬 입력을 덮어쓰지 않는다.
      current.ownKeys.splice(0, ownIndex + 1);
      return;
    }
    invalidateSearch();
    current.ownKeys = [];
    current.params = new URLSearchParams(params);
    current.browserLocation = browserLocation();
    current.query = params.get('q') || '';
    setQuery(current.query);
  }, [location.key, navigationType, params, invalidateSearch]);

  useEffect(() => () => cancelSearchTimer(), [cancelSearchTimer]);

  const changeSearch = useCallback((value, isComposing = false) => {
    const current = search.current;
    if (current.cancelledComposition && isComposing) return;
    cancelSearchTimer();
    current.query = value;
    setQuery(value);
    if (current.composing || isComposing || current.params.has('open')) return;
    const syncQuery = () => {
      const next = new URLSearchParams(current.params);
      if (value) next.set('q', value); else next.delete('q');
      replaceParams(next);
    };
    if (!value) { syncQuery(); return; }
    const revision = current.revision;
    current.timer = setTimeout(() => {
      if (revision !== current.revision) return;
      current.timer = null;
      if (current.composing || current.params.has('open')
        || current.browserLocation !== browserLocation()) return;
      syncQuery();
    }, 250);
  }, [cancelSearchTimer, replaceParams]);
  const clearSearch = () => {
    invalidateSearch();
    search.current.query = '';
    setQuery('');
    const next = new URLSearchParams(search.current.params);
    next.delete('q');
    replaceParams(next);
  };
  const updateFilter = (key, value) => {
    const next = new URLSearchParams(search.current.params);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    replaceParams(next);
  };
  const resetFilters = () => {
    invalidateSearch();
    search.current.query = '';
    setQuery('');
    const next = new URLSearchParams(search.current.params);
    ['cat', 'src', 'q'].forEach((key) => next.delete(key));
    replaceParams(next);
  };

  // 알림 진입: 필터를 풀고 렌더링한 다음 해당 줄에 포커스를 옮긴다.
  useEffect(() => {
    const current = search.current;
    const id = current.params.get('open');
    if (!id || status !== 'ready' || current.browserLocation !== browserLocation()) return;
    const target = events.find((event) => String(event.id) === id);
    const next = new URLSearchParams(current.params);
    // 렌더의 분야·출처와 ref의 최신 값을 섞지 않고 같은 파라미터로 판정한다.
    const latestCategory = INTEREST_CATEGORIES.some(({ id }) => id === next.get('cat')) ? next.get('cat') : 'all';
    const latestSource = SOURCES.some(({ id }) => id === next.get('src')) ? next.get('src') : 'all';
    if (target) {
      if (!filterNotices(events, { category: latestCategory, source: latestSource, query: current.query }).some((event) => event.id === target.id)) {
        invalidateSearch();
        current.query = '';
        setQuery('');
        ['cat', 'src', 'q'].forEach((key) => next.delete(key));
      }
      setSelectedId(target.id);
      setFocusId(target.id);
    }
    next.delete('open');
    replaceParams(next);
    // 알림 대기로 멈춘 검색은 재개하되, 초기화한 값과 진행 중인 조합은 다시 쓰지 않는다.
    if ((next.get('q') || '') !== current.query) changeSearch(current.query);
  }, [events, status, params, replaceParams, invalidateSearch, changeSearch]);

  useEffect(() => {
    if (!focusId) return;
    const row = rows.current.get(focusId);
    if (!row) return;
    row.focus({ preventScroll: true });
    row.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    setFocusId(null);
  }, [focusId, visible]);

  useEffect(() => {
    if (status === 'ready' && selectedId && !focusId && !params.has('open')
      && !visible.some((event) => event.id === selectedId)) setSelectedId(null);
  }, [visible, status, selectedId, focusId, params]);

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
      <div className="notice-search"><SearchIcon /><input aria-label="공지 검색" placeholder="공지 검색" value={query}
        onChange={(e) => changeSearch(e.target.value, e.nativeEvent.isComposing)}
        onCompositionStart={() => {
          cancelSearchTimer();
          search.current.composing = true;
          search.current.cancelledComposition = false;
        }}
        onCompositionEnd={(e) => {
          search.current.composing = false;
          if (search.current.cancelledComposition) {
            search.current.cancelledComposition = false;
            e.currentTarget.value = search.current.query;
            return;
          }
          changeSearch(e.currentTarget.value);
        }} />
        {query && <button type="button" aria-label="검색어 지우기" onClick={clearSearch}><CloseIcon /></button>}
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
