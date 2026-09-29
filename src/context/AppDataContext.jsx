import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as calendarService from '../services/calendarService';
import * as dashboardService from '../services/dashboardService';
import * as eventService from '../services/eventService';
import { enrichEvent } from '../utils/events';
import { getToday } from '../utils/date';

/**
 * 일정 데이터 + 캘린더 등록 상태를 여러 화면(Dashboard / 일정 목록 / 캘린더 / 사이드바)이 공유.
 * 데이터 접근은 항상 services 를 통해서만 한다. (컴포넌트에서 fetch 금지)
 */
const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const [nextEvents, nextSummary] = await Promise.all([
        eventService.getEvents(),
        dashboardService.getDashboardSummary(),
      ]);
      setEvents(nextEvents);
      setSummary(nextSummary);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** 낙관적 업데이트: 화면을 먼저 바꾸고 실패하면 되돌린다 */
  const patchEvents = useCallback(async (ids, patch, request) => {
    const previous = eventsRef.current;
    setActionError(null);
    setEvents((current) => current.map((event) => (ids.includes(event.id) ? { ...event, ...patch } : event)));
    try {
      await request();
    } catch (err) {
      setEvents(previous);
      setActionError(err);
    }
  }, []);

  const toggleRegister = useCallback(
    (id) => {
      const event = eventsRef.current.find((item) => item.id === id);
      if (!event) return;
      const registered = !event.registered;
      patchEvents([id], { registered }, () =>
        registered ? calendarService.registerEvent(id) : calendarService.unregisterEvent(id),
      );
    },
    [patchEvents],
  );

  const registerAll = useCallback(() => {
    // 마감일이 없는 일정(날짜 검토 필요)은 서버가 등록을 거부 → 하나라도 섞이면 전체가 되돌려지므로 제외
    const ids = eventsRef.current.filter((event) => !event.registered && event.end_date).map((event) => event.id);
    if (ids.length === 0) return Promise.resolve();
    return patchEvents(ids, { registered: true }, () => calendarService.registerEvents(ids));
  }, [patchEvents]);

  const toggleBookmark = useCallback(
    (id) => {
      const event = eventsRef.current.find((item) => item.id === id);
      if (!event) return;
      const bookmarked = !event.bookmarked;
      patchEvents([id], { bookmarked }, () => eventService.setBookmark(id, bookmarked));
    },
    [patchEvents],
  );

  // D-day, 임박도 등 화면용 파생 값
  const enrichedEvents = useMemo(() => {
    const today = getToday();
    return events.map((event) => enrichEvent(event, today));
  }, [events]);

  const value = useMemo(
    () => ({
      events: enrichedEvents,
      summary,
      status,
      error,
      actionError,
      refresh,
      toggleRegister,
      toggleBookmark,
      registerAll,
    }),
    [enrichedEvents, summary, status, error, actionError, refresh, toggleRegister, toggleBookmark, registerAll],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData 는 AppDataProvider 안에서만 사용할 수 있습니다.');
  return context;
}
