import { useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import EventCard from '../components/EventCard';
import { SOURCES, getSourceOrder } from '../config/sources';
import { useAppData } from '../context/AppDataContext';
import { compareByDeadline } from '../utils/events';

const SOURCE_FILTERS = [{ value: 'all', label: '전체' }, ...SOURCES.map((source) => ({ value: source.id, label: source.label }))];

const STATUS_FILTERS = [
  { value: 'all', label: '전체', test: () => true },
  { value: 'registered', label: '등록됨', test: (event) => event.registered },
  { value: 'unregistered', label: '미등록', test: (event) => !event.registered },
  { value: 'bookmark', label: '북마크', test: (event) => event.bookmarked },
];

const SORTS = [
  { value: 'deadline', label: '마감일순', compare: compareByDeadline },
  { value: 'recent', label: '최신순', compare: (a, b) => (b.collected_at ?? '').localeCompare(a.collected_at ?? '') },
  {
    value: 'src',
    label: '사이트순',
    compare: (a, b) => getSourceOrder(a.source) - getSourceOrder(b.source) || compareByDeadline(a, b),
  },
];

function FilterGroup({ options, value, onChange, style }) {
  return (
    <div className="filter-group" style={style}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`filter-btn ${value === option.value ? 'on' : ''}`.trim()}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function SchedulesPage() {
  const { events, status, toggleRegister, toggleBookmark } = useAppData();
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('deadline');

  const visibleEvents = useMemo(() => {
    const statusTest = STATUS_FILTERS.find((filter) => filter.value === statusFilter).test;
    const compare = SORTS.find((option) => option.value === sort).compare;
    return events
      .filter((event) => sourceFilter === 'all' || event.source === sourceFilter)
      .filter(statusTest)
      .sort(compare);
  }, [events, sourceFilter, statusFilter, sort]);

  return (
    <>
      <div className="page-header">
        <div className="page-title">일정 목록</div>
        <div className="page-sub">AI가 수집한 모든 일정을 관리하세요</div>
      </div>

      <div className="filter-bar">
        <FilterGroup options={SOURCE_FILTERS} value={sourceFilter} onChange={setSourceFilter} />
        <FilterGroup options={STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} style={{ marginLeft: 4 }} />
        <div className="filter-r">
          <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬">
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="schedule-list">
        {visibleEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onToggleRegister={() => toggleRegister(event.id)}
            onToggleBookmark={() => toggleBookmark(event.id)}
          />
        ))}
        {visibleEvents.length === 0 && (
          <EmptyState>{status === 'loading' ? '불러오는 중…' : '조건에 맞는 일정이 없습니다.'}</EmptyState>
        )}
      </div>
    </>
  );
}
