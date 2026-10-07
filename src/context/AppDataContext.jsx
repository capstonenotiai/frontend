import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as calendarService from '../services/calendarService';
import * as dashboardService from '../services/dashboardService';
import * as eventService from '../services/eventService';
import { enrichEvent } from '../utils/events';
import { getToday } from '../utils/date';
import RegisterConfirmDialog from '../components/RegisterConfirmDialog';

/**
 * 일정 데이터 + 캘린더 등록 상태를 여러 화면(Dashboard / 일정 목록 / 캘린더 / 사이드바)이 공유.
 * 데이터 접근은 항상 services 를 통해서만 한다. (컴포넌트에서 fetch 금지)
 */
const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const [events, setEvents] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [includeDismissed, setIncludeDismissed] = useState(false);
  const [registrationQueue, setRegistrationQueue] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);
  const actionLock = useRef(false);
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
      const [nextEvents, nextSummary, nextCalendar] = await Promise.all([
        eventService.getEvents(includeDismissed),
        dashboardService.getDashboardSummary(),
        calendarService.getRegisteredEvents(),
      ]);
      setEvents(nextEvents);
      setSummary(nextSummary);
      setCalendarEvents(nextCalendar);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  }, [includeDismissed]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Bundle writes can partially succeed in Google. Always reload the server's actual state.
  const runAction = useCallback(async (request) => {
    if (actionLock.current) return false;
    actionLock.current = true;
    setActionBusy(true);
    setActionError(null);
    try {
      await request();
      await refresh();
      return true;
    } catch (err) {
      await refresh();
      setActionError(err);
      return false;
    } finally {
      actionLock.current = false;
      setActionBusy(false);
    }
  }, [refresh]);

  const toggleRegister = useCallback(
    (id) => {
      const event = eventsRef.current.find((item) => item.id === id);
      if (!event) return;
      const registered = !event.registered;
      if (registered) { setRegistrationQueue([{ id, interview: event.event_type === 'interview' }]); return; }
      return runAction(() => calendarService.unregisterEvent(id));
    },
    [runAction],
  );

  const registerAll = useCallback(() => {
    // Each notice gets its own confirmation form before the next bundle is registered.
    const ids = eventsRef.current.filter((event) => !event.registered && event.event_type !== 'interview').map((event) => event.id);
    setRegistrationQueue(ids.map((id) => ({ id, interview: false })));
  }, []);

  const syncEvent = useCallback(async (id) => {
    setActionError(null);
    try { await calendarService.syncEvent(id); await refresh(); }
    catch (err) { setActionError(err); }
  }, [refresh]);

  const toggleBookmark = useCallback(
    (id) => {
      const event = eventsRef.current.find((item) => item.id === id);
      if (!event) return;
      const bookmarked = !event.bookmarked;
      return runAction(() => eventService.setBookmark(id, bookmarked));
    },
    [runAction],
  );

  const registerInterview = useCallback((id) => setRegistrationQueue([{ id, interview: true }]), []);
  const requestRegistration = useCallback((id, interview = false) => setRegistrationQueue([{ id, interview }]), []);
  const unregisterDetailEvent = useCallback((id) => runAction(() => calendarService.unregisterEvent(id)), [runAction]);
  const setActionStatus = useCallback((id, status) => runAction(() => eventService.setActionStatus(id, status)), [runAction]);
  const setDismissed = useCallback((id, value) => runAction(() => eventService.setDismissed(id, value)), [runAction]);

  const confirmRegistration = useCallback(async (overrides) => {
    const request = registrationQueue[0];
    if (!request) return false;
    const ok = await runAction(() => request.interview ? calendarService.registerInterview(request.id, overrides)
      : calendarService.registerEvent(request.id, overrides));
    if (ok) setRegistrationQueue((prev) => prev.slice(1));
    return ok;
  }, [registrationQueue, runAction]);

  // D-day, 임박도 등 화면용 파생 값
  const enrichedEvents = useMemo(() => {
    const today = getToday();
    return events.map((event) => enrichEvent(event, today));
  }, [events]);
  const enrichedCalendar = useMemo(() => calendarEvents.map((event) => enrichEvent(event, getToday())), [calendarEvents]);

  const value = useMemo(
    () => ({
      events: enrichedEvents,
      calendarEvents: enrichedCalendar,
      actionBusy,
      includeDismissed,
      setIncludeDismissed,
      setActionStatus,
      setDismissed,
      requestRegistration,
      registerInterview,
      unregisterDetailEvent,
      summary,
      status,
      error,
      actionError,
      refresh,
      toggleRegister,
      toggleBookmark,
      registerAll,
      syncEvent,
    }),
    [enrichedEvents, enrichedCalendar, actionBusy, includeDismissed, setActionStatus, setDismissed, requestRegistration, registerInterview, unregisterDetailEvent, summary, status, error, actionError, refresh, toggleRegister, toggleBookmark, registerAll, syncEvent],
  );

  return <AppDataContext.Provider value={value}>{children}
    {registrationQueue[0] && <RegisterConfirmDialog request={registrationQueue[0]} busy={actionBusy}
      onCancel={() => setRegistrationQueue([])} onConfirm={confirmRegistration} />}
  </AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error('useAppData 는 AppDataProvider 안에서만 사용할 수 있습니다.');
  return context;
}
